import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import db from './db.js';
import authRoutes from './routes/authRoutes.js';
import tenderRoutes from './routes/tenderRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors({
  origin: config.frontendUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files locally if stored on disk
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health & Root status endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Tender & RFP Intelligence API' });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'AI-Powered Tender & RFP Intelligence API running',
    version: '1.0.0',
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
      tenders: ['POST /api/tenders/upload', 'GET /api/tenders', 'GET /api/tenders/:id', 'DELETE /api/tenders/:id'],
      analytics: ['GET /api/analytics'],
    }
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error Handling Middleware
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, async () => {
  console.log(`🚀 Tender & RFP Intelligence Backend listening on port ${PORT}`);
  console.log(`📡 Base API URL: http://localhost:${PORT}/api`);
  await db.checkConnection();
});

export default app;
