import pdfParse from 'pdf-parse';
import fs from 'fs';

/**
 * Extracts raw text from a PDF buffer or file path.
 * Returns { text, numpages, info }
 */
export async function parsePdfDocument(input) {
  try {
    let dataBuffer;
    if (Buffer.isBuffer(input)) {
      dataBuffer = input;
    } else if (typeof input === 'string') {
      dataBuffer = fs.readFileSync(input);
    } else {
      throw new Error('Invalid input for PDF parsing: expected Buffer or filepath string');
    }

    const data = await pdfParse(dataBuffer);

    return {
      success: true,
      text: data.text || '',
      pageCount: data.numpages || 1,
      info: data.info || {},
    };
  } catch (error) {
    console.error('PDF Parsing failed:', error.message);
    return {
      success: false,
      text: '',
      pageCount: 0,
      error: error.message || 'Failed to parse PDF document buffer',
      info: {}
    };
  }
}

export default parsePdfDocument;
