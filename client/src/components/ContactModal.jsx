import React from 'react';
import { Mail, X } from 'lucide-react';
import './SettingsModal.css';
import './ContactModal.css';

export default function ContactModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal-card contact-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Mail size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span>Contact CovrIQ</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }} aria-label="Close contact modal">
            <X size={18} />
          </button>
        </div>

        <div className="settings-section-list contact-modal-body">
          <div className="contact-mail-card">
            <span className="settings-group-title">Mail Us</span>
            <a href="mailto:covriq.app@gmail.com">covriq.app@gmail.com</a>
            <p>For support, feedback, bugs, partnership questions, or product suggestions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
