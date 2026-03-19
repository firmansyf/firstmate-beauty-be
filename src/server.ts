// src/server.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded from other origins
}));
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(compression()); // Compress responses
app.use(morgan('dev')); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Static files for uploads - use absolute path
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Alfath Skin API',
    version: '1.0.0',
    description: 'Backend API untuk Alfath Skin E-Commerce',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      upload: '/api/upload',
    },
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'Endpoint tidak ditemukan',
    path: req.path,
  });
});

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  
  res.status(500).json({
    message: 'Terjadi kesalahan server',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║   ✨ Alfath Skin API Server Running       
  ║                                       
  ║   Port: ${PORT}                       
  ║   Environment: ${process.env.NODE_ENV || 'development'}
  ║   URL: http://localhost:${PORT}       
  ║                                       ║
  ╚═══════════════════════════════════════╝
  `);
});

export default app;