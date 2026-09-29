import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import { validateTenderContent } from './tenderValidator.js';

/**
 * Analyzes extracted tender PDF text with Google Gemini AI.
 * First enforces a semantic classification gate to verify the document is
 * an authentic Tender/RFP before performing structural intelligence extraction.
 */
export async function analyzeTenderWithGemini(extractedText, filename = 'Uploaded-Tender.pdf') {
  if (config.gemini.apiKey && config.gemini.apiKey.trim() !== '') {
    try {
      const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        }
      });

      const prompt = `
You are an Enterprise Bid Intelligence & Document Verification AI.
CRITICAL FIRST STEP: Analyze the extracted document text and CLASSIFY whether this document is an authentic Tender, RFP (Request for Proposal), RFQ, Bidding Specification, or Procurement Solicitation document.

If the document is NOT a tender or procurement solicitation (for instance: if it is a personal resume/CV, invoice, commercial receipt, restaurant menu, student homework, novel, syllabus, or general unrelated document), you MUST set "isTenderDocument": false and specify the "rejectionReason". DO NOT invent fake tender values for non-tender documents.

Document Name: "${filename}"

Return a valid JSON object matching this schema strictly:
{
  "isTenderDocument": true, // boolean: set to false if NOT an authentic tender/RFP/bidding document
  "documentClassification": "Official Tender/RFP", // or "Resume/CV", "Invoice/Receipt", "Academic/Coursework", "General Document", "Other"
  "rejectionReason": null, // If isTenderDocument is false, describe why (e.g. "The uploaded file is a resume/CV, not a procurement tender.")
  "title": "A clear, professional project title inferred from the document",
  "buyer": "The procuring agency / authority name",
  "estimatedValue": "Estimated budget or contract value (e.g. $12,500,000) or 'TBD'",
  "summary": "Executive summary of the procurement objectives (2-3 sentences)",
  "riskScore": 3.8, // A float between 0.0 and 5.0 indicating bid complexity & penalty risks
  "riskReasoning": "Detailed justification of why this risk score was assigned",
  "deadlines": [
    {
      "title": "Deadline description (e.g., Submission Deadline, Pre-bid meeting)",
      "date": "Estimated or explicit date (e.g., 2026-10-15)",
      "clause": "Document clause or section reference"
    }
  ],
  "eligibilityRequirements": [
    {
      "clause": "Specific eligibility criterion (e.g., Min turnover, past performance)",
      "status": "Compliant" // or "Attention" or "Critical"
    }
  ],
  "complianceRequirements": [
    {
      "clause": "Compliance mandate (e.g., ISO certification, security clearance)",
      "status": "Compliant" // or "Attention" or "Critical"
    }
  ],
  "keyInformation": [
    { "label": "Contract Type", "value": "Fixed Price / Cost-Plus" },
    { "label": "Submission Format", "value": "Electronic submission via procurement portal" }
  ]
}

Document Text:
"""
${extractedText.slice(0, 15000)}
"""
`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Enforce classification flag
      if (parsed.isTenderDocument === undefined) {
        parsed.isTenderDocument = true;
      }

      return parsed;
    } catch (apiError) {
      console.warn('⚠️ Gemini API call failed or quota reached. Utilizing intelligent heuristic fallback:', apiError.message);
    }
  }

  // Intelligent Heuristic Fallback Parser
  return generateHeuristicExtraction(extractedText, filename);
}

/**
 * Heuristic extractor parsing real signals from document text
 * when Gemini API key is not configured or offline.
 * Enforces Gate 1 verification first.
 */
function generateHeuristicExtraction(text, filename) {
  // Validate if document content matches tender semantics
  const validation = validateTenderContent(text, filename);
  if (!validation.isValid) {
    return {
      isTenderDocument: false,
      documentClassification: validation.category || 'Non-Tender Document',
      rejectionReason: validation.reason,
      title: 'Rejected Document',
      buyer: 'N/A',
      estimatedValue: 'N/A',
      summary: validation.reason,
      riskScore: 0.0,
      riskReasoning: validation.reason,
      deadlines: [],
      eligibilityRequirements: [],
      complianceRequirements: [],
      keyInformation: []
    };
  }

  const cleanFilename = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const title = cleanFilename.charAt(0).toUpperCase() + cleanFilename.slice(1);

  // Real buyer regex
  const buyerRegex = /(?:issuing agency|issuing authority|buyer|procuring authority|procuring entity|client|organization|department)[:\s]+([^\n\r,.;]{3,80})/i;
  const buyerMatch = text.match(buyerRegex);
  const buyer = buyerMatch ? buyerMatch[1].trim() : 'Undisclosed Issuing Authority';

  // Real budget regex
  const budgetRegex = /(\$\s?[\d,]+(?:\.\d+)?\s*(?:billion|million|thousand|M|B|K)?|USD\s?[\d,]+|INR\s?[\d,]+|EUR\s?[\d,]+)/i;
  const budgetMatch = text.match(budgetRegex);
  const estimatedValue = budgetMatch ? budgetMatch[1].trim() : 'Undisclosed';

  // Real date detection from text
  const dateRegex = /(?:deadline|due date|submission date|closing date|bid opening|conference)[:\s]+([A-Za-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi;
  const deadlines = [];
  let match;
  while ((match = dateRegex.exec(text)) !== null && deadlines.length < 5) {
    deadlines.push({
      title: match[0].split(/[:\n]/)[0].trim(),
      date: match[1].trim(),
      clause: `Extracted from text near position ${match.index}`
    });
  }

  // Real risk calculation based on actual keyword presence
  const penaltyKeywords = [
    'liquidated damages',
    'indemnification',
    'penalty',
    'strict liability',
    'unlimited liability',
    'foreign ownership',
    'security clearance',
    'termination for default',
    'forfeiture of bid security'
  ];

  const detectedRiskFactors = [];
  penaltyKeywords.forEach(word => {
    if (text.toLowerCase().includes(word)) {
      detectedRiskFactors.push(word);
    }
  });

  let riskScore = 1.0;
  if (detectedRiskFactors.length > 0) {
    riskScore = Math.min(5.0, +(1.5 + detectedRiskFactors.length * 0.7).toFixed(1));
  }

  const riskReasoning = detectedRiskFactors.length > 0
    ? `Document contains ${detectedRiskFactors.length} legal/liability risk factor(s): ${detectedRiskFactors.join(', ')}.`
    : 'No severe liability or penalty clauses detected in document text.';

  // Extract sentences mentioning requirements or eligibility
  const sentences = text.split(/(?<=[.?!])\s+/);
  const eligibilityRequirements = [];
  const complianceRequirements = [];

  sentences.forEach((sentence) => {
    const sLower = sentence.toLowerCase().trim();
    if (sLower.length < 25 || sLower.length > 300) return;

    if (
      (sLower.includes('must have') || sLower.includes('minimum') || sLower.includes('eligibility') || sLower.includes('qualification') || sLower.includes('turnover')) &&
      eligibilityRequirements.length < 5
    ) {
      eligibilityRequirements.push({
        clause: sentence.trim(),
        status: sLower.includes('strict') || sLower.includes('mandatory') ? 'Attention' : 'Compliant'
      });
    }

    if (
      (sLower.includes('iso') || sLower.includes('compliance') || sLower.includes('certif') || sLower.includes('guarantee') || sLower.includes('sla')) &&
      complianceRequirements.length < 5
    ) {
      complianceRequirements.push({
        clause: sentence.trim(),
        status: sLower.includes('penalty') || sLower.includes('critical') ? 'Critical' : 'Compliant'
      });
    }
  });

  // Key facts from text
  const keyInformation = [];
  if (budgetMatch) keyInformation.push({ label: 'Contract Budget', value: budgetMatch[1].trim() });
  if (buyerMatch) keyInformation.push({ label: 'Issuing Body', value: buyerMatch[1].trim() });
  if (deadlines.length > 0) keyInformation.push({ label: 'Primary Cutoff', value: deadlines[0].date });

  const summary = sentences.slice(0, 3).join(' ').trim() || `Tender document ${filename} analyzed and parsed.`;

  return {
    isTenderDocument: true,
    documentClassification: 'Official Tender/RFP',
    rejectionReason: null,
    title,
    buyer,
    estimatedValue,
    summary,
    riskScore,
    riskReasoning,
    deadlines,
    eligibilityRequirements,
    complianceRequirements,
    keyInformation
  };
}

export default analyzeTenderWithGemini;
