import { parsePdfDocument } from '../utils/pdfParser.js';
import { analyzeTenderWithGemini } from '../utils/gemini.js';
import { uploadDocument } from '../utils/cloudinary.js';
import { validateTenderContent } from '../utils/tenderValidator.js';
import db from '../db.js';

/**
 * Handles PDF upload, two-gate tender validation, Gemini AI analysis,
 * Cloudinary persistent storage, and saving to database
 */
export async function uploadTender(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file was uploaded. Please provide a valid tender PDF document.',
      });
    }

    const file = req.file;
    console.log(`📄 Ingesting uploaded PDF: ${file.originalname} (${file.size} bytes)`);

    // 1. Extract text from the uploaded PDF buffer
    const pdfResult = await parsePdfDocument(file.buffer);

    if (!pdfResult.success || !pdfResult.text || pdfResult.text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: 'UNREADABLE_PDF',
        message: 'Unable to extract text from the PDF. Please ensure the document is not password-protected, encrypted, or an empty scan.',
      });
    }

    // 2. GATE 1: Heuristic & Semantic Pattern Validation
    const heuristicCheck = validateTenderContent(pdfResult.text, file.originalname);
    if (!heuristicCheck.isValid) {
      console.warn(`⛔ [Gate 1 Rejected] ${file.originalname}: ${heuristicCheck.reason}`);
      return res.status(422).json({
        success: false,
        code: 'INVALID_DOCUMENT_TYPE',
        message: heuristicCheck.reason || 'The uploaded file does not contain official procurement, bidding, or RFP terminology. Only tender specifications are accepted.',
      });
    }

    // 3. GATE 2: Gemini AI Semantic Classification & Analysis
    const aiAnalysis = await analyzeTenderWithGemini(pdfResult.text, file.originalname);

    if (aiAnalysis && aiAnalysis.isTenderDocument === false) {
      console.warn(`⛔ [Gate 2 Rejected] ${file.originalname}: ${aiAnalysis.rejectionReason}`);
      return res.status(422).json({
        success: false,
        code: 'NON_TENDER_DOCUMENT',
        message: aiAnalysis.rejectionReason || 'The verification engine determined that this document is not an official Tender, RFP, or Procurement Solicitation.',
      });
    }

    // 4. Verification Succeeded: Upload verified tender to Cloudinary persistent storage
    const storageResult = await uploadDocument(file);

    // Return analyzed dossier WITHOUT saving to DB yet (tender is only registered after Step 5 completion)
    const pendingTender = {
      title: aiAnalysis.title || file.originalname.replace(/\.[^/.]+$/, ''),
      status: 'Pending Registration',
      riskScore: typeof aiAnalysis.riskScore === 'number' ? aiAnalysis.riskScore : 1.0,
      documentUrl: storageResult.url,
      fileName: file.originalname,
      fileSize: file.size,
      pageCount: pdfResult.pageCount || 1,
      buyer: aiAnalysis.buyer || 'Undisclosed Buyer',
      estimatedValue: aiAnalysis.estimatedValue || 'Undisclosed',
      summary: aiAnalysis.summary || 'Tender specification ingested and indexed.',
    };

    return res.status(200).json({
      success: true,
      message: 'Tender analyzed successfully. Ingestion dossier ready for 5-step review.',
      data: {
        tender: pendingTender,
        rawAnalysis: aiAnalysis,
        meta: {
          pages: pdfResult.pageCount,
          fileSize: file.size,
          documentUrl: storageResult.url,
        }
      }
    });
  } catch (error) {
    console.error('Tender processing error:', error);
    next(error);
  }
}

/**
 * Finalizes the 5-step flow and officially records the tender in the database.
 * Only called when the user completes Phase 5!
 */
export async function registerTender(req, res, next) {
  try {
    const { tender, rawAnalysis } = req.body;

    if (!tender) {
      return res.status(400).json({
        success: false,
        message: 'No tender dossier provided for registration.',
      });
    }

    console.log(`📝 Officially registering tender in database after Step 5: ${tender.title}`);

    // Assemble requirements array
    const requirements = [];

    if (rawAnalysis?.eligibilityRequirements) {
      rawAnalysis.eligibilityRequirements.forEach(item => {
        requirements.push({
          clause: item.clause,
          type: 'Eligibility',
          status: item.status || 'Compliant',
        });
      });
    }

    if (rawAnalysis?.deadlines) {
      rawAnalysis.deadlines.forEach(item => {
        requirements.push({
          clause: `${item.title}: ${item.date} [${item.clause || 'General Timeline'}]`,
          type: 'Deadline',
          status: 'Attention',
        });
      });
    }

    if (rawAnalysis?.complianceRequirements) {
      rawAnalysis.complianceRequirements.forEach(item => {
        requirements.push({
          clause: item.clause,
          type: 'Compliance',
          status: item.status || 'Compliant',
        });
      });
    }

    // Generate initial action tasks from deadlines
    const tasks = (rawAnalysis?.deadlines || []).slice(0, 3).map((d, index) => ({
      title: `Fulfill ${d.title}`,
      assignedTo: 'Lead Proposal Engineer',
      dueDate: d.date ? new Date(d.date) : new Date(Date.now() + (index + 7) * 86400000),
      status: 'Pending',
      priority: index === 0 ? 'High' : 'Medium',
    }));

    // Save official tender record to database
    const tenderRecord = await db.createTender(
      {
        title: tender.title || 'Untitled Procurement Solicitation',
        status: 'Active',
        riskScore: typeof tender.riskScore === 'number' ? tender.riskScore : 1.0,
        documentUrl: tender.documentUrl || '#',
        fileName: tender.fileName,
        fileSize: tender.fileSize,
        pageCount: tender.pageCount || 1,
        buyer: tender.buyer || 'Undisclosed Buyer',
        estimatedValue: tender.estimatedValue || 'Undisclosed',
        summary: tender.summary || 'Tender specification ingested and indexed.',
        userId: req.user ? req.user.id : null,
      },
      requirements,
      tasks
    );

    return res.status(201).json({
      success: true,
      message: 'Tender officially registered into active procurement registry.',
      data: tenderRecord,
    });
  } catch (error) {
    console.error('Tender registration error:', error);
    next(error);
  }
}

/**
 * Retrieves all tenders
 */
export async function getAllTenders(req, res, next) {
  try {
    const tenders = await db.getAllTenders();
    return res.json({
      success: true,
      count: tenders.length,
      data: tenders,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves a single tender by ID
 */
export async function getTenderById(req, res, next) {
  try {
    const { id } = req.params;
    const tender = await db.getTenderById(id);

    if (!tender) {
      return res.status(404).json({
        success: false,
        message: `Tender with ID ${id} was not found.`,
      });
    }

    return res.json({
      success: true,
      data: tender,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a tender by ID
 */
export async function deleteTender(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await db.deleteTender(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Tender with ID ${id} was not found.`,
      });
    }

    return res.json({
      success: true,
      message: 'Tender removed successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export default { uploadTender, getAllTenders, getTenderById, deleteTender };
