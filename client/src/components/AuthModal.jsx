import React, { useEffect, useState } from 'react';
import { X, TrendingUp, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose, initialView = 'login' }) {
  const { login, register, requestOtp, resetPassword } = useAuth();
  const [view, setView] = useState(initialView); // 'login' | 'register' | 'forgot_otp_step1' | 'forgot_otp_step2'

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setView(initialView);
    setEmail('');
    setPassword('');
    setName('');
    setOtpCode('');
    setNewPassword('');
    setError(null);
    setSuccessMsg(null);
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await requestOtp(email);
      setSuccessMsg(data.message || 'OTP sent to your email.');
      setOtpCode('');
      setView('forgot_otp_step2');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email, otpCode, newPassword);
      setSuccessMsg('Password updated successfully! Signing you in...');
      setView('login');
      setPassword('');
      setNewPassword('');
      setOtpCode('');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="auth-header">
          <button className="auth-close-btn" onClick={onClose}>
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div className="brand-icon" style={{ width: '28px', height: '28px' }}>
              <TrendingUp size={16} strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '800' }}>
              Covr<span style={{ color: 'var(--accent-cyan)' }}>IQ</span>
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {view === 'login' && 'Sign in to access saved picks, history & sync across devices.'}
            {view === 'register' && 'Create your free account for persistent AI sports handicapping.'}
            {view.startsWith('forgot') && 'Reset your password with the 6-digit code sent to your email.'}
          </p>
        </div>

        {/* Tab Switcher for Login / Register */}
        {(view === 'login' || view === 'register') && (
          <div className="auth-tabs">
            <button
              className={`auth-tab-btn ${view === 'login' ? 'active' : ''}`}
              onClick={() => { setView('login'); setError(null); }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab-btn ${view === 'register' ? 'active' : ''}`}
              onClick={() => { setView('register'); setError(null); }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error / Success Notifications */}
        <div style={{ padding: '0 24px' }}>
          {error && <div className="auth-error-msg">{error}</div>}
          {successMsg && <div className="auth-success-msg">{successMsg}</div>}
        </div>

        {/* Forms */}
        {view === 'login' && (
          <form className="auth-form" onSubmit={handleLogin} autoComplete="off">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                name="covriq-login-email"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="form-input"
                placeholder="bettor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                name="covriq-login-passcode"
                autoComplete="new-password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <span
              className="forgot-password-link"
              onClick={() => { setView('forgot_otp_step1'); setError(null); }}
            >
              Forgot Password?
            </span>

            <button type="submit" className="submit-auth-btn" disabled={loading}>
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        )}

        {view === 'register' && (
          <form className="auth-form" onSubmit={handleRegister} autoComplete="off">
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                name="covriq-display-name"
                autoComplete="off"
                className="form-input"
                placeholder="Sharp Hand"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                name="covriq-register-email"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="form-input"
                placeholder="bettor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password (6+ chars)</label>
              <input
                type="password"
                required
                minLength={6}
                name="covriq-register-passcode"
                autoComplete="new-password"
                className="form-input"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="submit-auth-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Get Started'}
            </button>
          </form>
        )}

        {view === 'forgot_otp_step1' && (
          <form className="auth-form" onSubmit={handleRequestOtp} autoComplete="off">
            <div className="form-group">
              <label className="form-label">Enter Account Email</label>
              <input
                type="email"
                required
                name="covriq-reset-email"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="form-input"
                placeholder="bettor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button type="submit" className="submit-auth-btn" disabled={loading}>
              {loading ? 'Sending Verification Code...' : 'Send 6-Digit OTP'}
            </button>

            <button
              type="button"
              onClick={() => setView('login')}
              style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {view === 'forgot_otp_step2' && (
          <form className="auth-form" onSubmit={handleResetPassword} autoComplete="off">
            <div className="reset-step-banner">
              <ShieldCheck size={16} />
              <span>Step 2 of 2: enter the code from your inbox.</span>
            </div>
            <div className="form-group">
              <label className="form-label">6-Digit OTP Code</label>
              <input
                type="text"
                required
                maxLength={6}
                inputMode="numeric"
                name="covriq-reset-code"
                autoComplete="one-time-code"
                className="form-input"
                style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '20px', fontWeight: '700' }}
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                name="covriq-new-passcode"
                autoComplete="new-password"
                className="form-input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="submit-auth-btn" disabled={loading || otpCode.length !== 6 || newPassword.length < 6}>
              {loading ? 'Updating Password...' : 'Reset & Sign In'}
            </button>
            <button
              type="button"
              className="auth-secondary-btn"
              onClick={() => { setView('login'); setError(null); setSuccessMsg(null); }}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}



