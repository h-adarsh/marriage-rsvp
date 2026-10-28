import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { weddingsRouter } from './routes/weddings';
import { functionsRouter } from './routes/functions';
import { householdsRouter } from './routes/households';
import { csrfProtection } from './middleware/csrf';

dotenv.config({ path: '../.env' });
dotenv.config();

export const app = express();

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = [clientUrl, 'http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(csrfProtection);

// Base health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'wedding-rsvp-api',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use('/api/auth', authRouter);

// Wedding & function management routes
app.use('/api/weddings', weddingsRouter);
app.use('/api/functions', functionsRouter);
app.use('/api/households', householdsRouter);

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File size exceeds 2MB limit' });
    return;
  }

  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'Forbidden: Untrusted cross-origin request rejected' });
    return;
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    ...(isProduction ? {} : { stack: err.stack }),
  });
});
