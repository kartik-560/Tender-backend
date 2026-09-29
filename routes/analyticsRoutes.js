import { Router } from 'express';
import { getAnalytics } from '../controller/analyticsController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticateToken, getAnalytics);

export default router;
