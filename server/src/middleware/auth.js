import jwt from 'jsonwebtoken';
import prisma from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'covriq_super_secure_jwt_secret_key_2026_sports_ai';

/**
 * Middleware that requires a valid JWT Bearer token.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        created_at: true,
        preference: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User session not found or expired.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

/**
 * Middleware that attaches user if JWT is provided, but allows guest access if omitted.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        created_at: true,
        preference: true
      }
    });

    req.user = user || null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}
