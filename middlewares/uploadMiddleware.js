import multer from 'multer';

// Use memory storage for direct buffer access (for both Cloudinary and pdf-parse)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are supported for RFP document ingestion'), false);
  }
};

export const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB max
  },
  fileFilter,
});

export default uploadPdf;
