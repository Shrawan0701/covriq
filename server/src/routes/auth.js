import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendOtpEmail } from '../services/emailService.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'covriq_super_secure_jwt_secret_key_2026_sports_ai';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Helper to generate JWT token.
 */
function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password_hash,
        name: name?.trim() || normalizedEmail.split('@')[0],
                preference: {
          create: {
            theme: 'dark',
            odds_format: 'both',
            chat_font: 'serif',
            selected_sport: 'mlb',
            selected_league: null
          }
        }
      },
      include: {
        preference: true
      }
    });

    const token = createToken(user.id);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        preference: user.preference
      }
    });
  } catch (error) {
    console.error('[Auth Route] Registration error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { preference: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createToken(user.id);

    return res.json({
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        preference: user.preference
      }
    });
  } catch (error) {
    console.error('[Auth Route] Login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    return res.json({ user: req.user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  return res.json({ message: 'Logged out successfully.' });
});

/**
 * POST /api/auth/forgot-password (Sends 6-digit Brevo OTP)
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // Always respond with success to avoid email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists, a 6-digit OTP code has been sent.' });
    }

    // Generate random 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otpCode, 8);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token: hashedOtp,
        reset_token_expiry: expiry
      }
    });

    // Send email via Brevo API
    const emailResult = await sendOtpEmail(user.email, otpCode, user.name || 'Bettor');

    return res.json({
      message: 'A 6-digit verification code has been sent to your email.',
      devOtp: emailResult.devCode || undefined // For effortless local testing if Brevo key is not set
    });
  } catch (error) {
    console.error('[Auth Route] Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

/**
 * POST /api/auth/reset-password (Verify OTP and change password)
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.reset_token || !user.reset_token_expiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP code.' });
    }

    if (new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({ error: 'OTP code has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp.toString().trim(), user.reset_token);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Hash new password and clear reset token
    const password_hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        reset_token: null,
        reset_token_expiry: null
      }
    });

    const token = createToken(user.id);

    return res.json({
      message: 'Password successfully reset.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      }
    });
  } catch (error) {
    console.error('[Auth Route] Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

export default router;
