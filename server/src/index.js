import './config/env.js';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import conversationsRoutes from './routes/conversations.js';
import savedRoutes from './routes/saved.js';
import settingsRoutes from './routes/settings.js';
import edgeScannerRoutes from './routes/edgeScanner.js';
import alertRoutes from './routes/alerts.js';
import communityRoutes from './routes/community.js';
import prisma from './db.js';
import { isSerpApiConfigured } from './config/env.js';

const app = express();
const PORT = process.env.PORT || 5002;


// Enable CORS for frontend
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5174',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Request logger for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'CovrIQ Backend API',
    model: process.env.OPENAI_MODEL || 'gpt-5.6',
    serpApiConfigured: Boolean(process.env.SERPAPI_API_KEY && process.env.SERPAPI_API_KEY.trim().length > 5),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/edge-scanner', edgeScannerRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/community', communityRoutes);


// SPA static serving + history fallback.
// Each Discover Mode now lives at its own deep URL (/ai-picks, /value-finder,
// ...), so when a production build exists we serve the built assets and let
// any non-API, non-health path fall through to index.html. In dev the Vite dev
// server (with its own SPA fallback + /api proxy) handles this instead, so
// this block only activates when client/dist has been built.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!(api|health)(\/|$)).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[CovrIQ Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// Start Server
app.listen(PORT, async () => {
  const serpConfigured = isSerpApiConfigured();
  console.log(`====================================================`);
  console.log(`Ã°Å¸Å¡â‚¬ CovrIQ Server running on http://localhost:${PORT}`);
  console.log(`Ã°Å¸Â§Â  AI Engine Model: ${process.env.OPENAI_MODEL || 'gpt-5.6'} (Web Search Enabled)`);
  console.log(`Ã°Å¸â€Â Sports Data Provider: SerpApi (Primary) [SERPAPI_CONFIGURED=${serpConfigured}]`);
  console.log(`SERPAPI_CONFIGURED=${serpConfigured}`);
  console.log(`Ã°Å¸Å’Â Client Origin: ${process.env.CLIENT_URL || 'http://localhost:5174'}`);
  console.log(`====================================================`);

  // Optional DB verification
  try {
    await prisma.$connect();
    console.log(`Ã¢Å“â€¦ Database connected successfully.`);
  } catch (err) {
    console.warn(`Ã¢Å¡Â Ã¯Â¸Â Database connection notice:`, err.message);
    console.log(`Ã¢â€žÂ¹Ã¯Â¸Â CovrIQ server will continue running. Ensure PostgreSQL or Prisma migrations are active.`);
  }
});



