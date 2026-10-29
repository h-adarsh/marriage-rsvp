import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { weddingsRouter } from './routes/weddings';
import { functionsRouter } from './routes/functions';
import { householdsRouter } from './routes/households';
import { rsvpRouter } from './routes/rsvp';
import { csrfProtection, getAllowedOrigins } from './middleware/csrf';
import { parseTrustProxy } from './utils/proxy';

dotenv.config({ path: '../.env' });
dotenv.config();

export const app = express();

// Configure trust proxy setting dynamically from environment
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = getAllowedOrigins();
    if (!origin || allowed.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Security response headers (OWASP best practices)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self';"
  );
  next();
});

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
app.use('/api/rsvp', rsvpRouter);

// In production, serve the compiled Vite SPA static files and fallback to index.html for client routing
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

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
