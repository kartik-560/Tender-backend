/**
 * Tender & RFP Document Verification Gate (Gate 1)
 *
 * Scans extracted document text for procurement domain markers, bidding terminology,
 * and structural signals. Rejects non-tender documents (resumes, invoices, menus,
 * academic papers, novels, etc.) before calling Gemini AI or uploading to Cloudinary.
 */

export function validateTenderContent(text, filename = '') {
  if (!text || typeof text !== 'string') {
    return {
      isValid: false,
      reason: 'No readable text content found in document. Please ensure the PDF is not encrypted, password-protected, or an empty scan.',
    };
  }

  const trimmed = text.trim();

  // Minimum content length: genuine procurement solicitations are not just a few words
  if (trimmed.length < 80) {
    return {
      isValid: false,
      reason: 'Document contains insufficient text content (under 80 characters) to be verified as an official Tender or RFP specification.',
    };
  }

  const lower = trimmed.toLowerCase();

  // Negative Indicators: Strongly indicate non-tender document categories
  const negativeSignals = [
    {
      regex: /\b(curriculum vitae|resume|c\.v\.|education\s*:\s*|work experience\s*:|skills\s*:\s*|objective\s*:\s*seeking|hobbies\s*:)\b/i,
      category: 'Resume / CV',
    },
    {
      regex: /\b(tax invoice|invoice no|invoice #|billed to\s*:|remit to\s*:|subtotal\s*:|amount due\s*:|payment terms\s*: net \d+)\b/i,
      category: 'Invoice / Commercial Receipt',
    },
    {
      regex: /\b(restaurant menu|appetizer|beverages|main course|dessert menu|wine list)\b/i,
      category: 'Food / Restaurant Menu',
    },
    {
      regex: /\b(course syllabus|homework assignment|semester \d+|lecture notes|grading rubric|midterm exam|final exam)\b/i,
      category: 'Academic Course / Homework',
    },
    {
      regex: /\b(user manual|quick start guide|troubleshooting guide|warranty card|safety instructions for use)\b/i,
      category: 'Product / User Manual',
    },
  ];

  // Core procurement terms list
  const procurementSignals = [
    'tender',
    'rfp',
    'request for proposal',
    'request for quotation',
    'rfq',
    'solicitation',
    'procurement',
    'bidder',
    'bidders',
    'bidding',
    'bid document',
    'notice inviting tender',
    'nit',
    'scope of work',
    'statement of work',
    'terms of reference',
    'eligibility criteria',
    'pre-qualification',
    'submission deadline',
    'bid submission',
    'bill of quantities',
    'boq',
    'liquidated damages',
    'earnest money',
    'bid security',
    'emd',
    'contractor',
    'subcontractor',
    'procuring authority',
    'procuring entity',
    'issuing authority',
    'commercial bid',
    'technical bid',
    'technical proposal',
    'financial proposal',
    'indemnification',
    'general conditions of contract',
    'special conditions of contract',
    'far clause',
    'far 52.',
    'defense federal acquisition',
    'contract award',
    'evaluation criteria'
  ];

  // Check for negative category matches
  for (const signal of negativeSignals) {
    if (signal.regex.test(lower)) {
      // Check if it's accompanied by strong tender markers
      const tenderMatchCount = procurementSignals.filter(w => lower.includes(w)).length;
      if (tenderMatchCount < 2) {
        return {
          isValid: false,
          category: signal.category,
          reason: `Document rejected: The uploaded file appears to be a ${signal.category} rather than an official Tender or RFP specification.`,
        };
      }
    }
  }

  // Count unique procurement markers found in text
  const matchedTerms = [];
  for (const sig of procurementSignals) {
    if (lower.includes(sig)) {
      matchedTerms.push(sig);
    }
  }

  // A valid tender or RFP must contain at least 2 distinct procurement terms
  if (matchedTerms.length < 2) {
    return {
      isValid: false,
      matchedCount: matchedTerms.length,
      reason: 'Validation failed: The uploaded PDF does not contain required procurement, bidding, or RFP terminology (e.g. Scope of Work, Eligibility Criteria, Tender/RFP identifier).',
    };
  }

  return {
    isValid: true,
    matchedCount: matchedTerms.length,
    matchedTerms: matchedTerms.slice(0, 8),
  };
}

export default validateTenderContent;
