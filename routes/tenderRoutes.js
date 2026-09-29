import { Router } from 'express';
import {
  uploadTender,
  registerTender,
  getAllTenders,
  getTenderById,
  deleteTender,
} from '../controller/tenderController.js';
import { uploadPdf } from '../middlewares/uploadMiddleware.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/upload', authenticateToken, uploadPdf.single('document'), uploadTender);
router.post('/register', authenticateToken, registerTender);
router.get('/', authenticateToken, getAllTenders);
router.get('/:id', authenticateToken, getTenderById);
router.delete('/:id', authenticateToken, deleteTender);

export default router;
