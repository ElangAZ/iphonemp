import React, { useState, useEffect, useRef } from 'react';
import { activateLicense, revalidateStoredLicense, getStoredLicense, getOrCreateDeviceHwid } from './keyauth';
import './KeyAuthGate.css';

/**
 * KeyAuthGate - Premium license key gate screen
 * Blocks access to the app until a valid KeyAuth license key is provided.
 * Persists valid license in localStorage and re-validates on startup.
 */
export default function KeyAuthGate({ onAuthenticated }) {
  const [phase, setPhase] = useState('checking'); // 'checking', 'input', 'success'
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'error' | 'success'
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [hwid, setHwid] = useState('');
  const inputRef = useRef(null);

  // On mount, check if we have a stored license
  useEffect(() => {
    setHwid(getOrCreateDeviceHwid());
    const checkStored = async () => {
      const stored = getStoredLicense();
      if (!stored) {
        setPhase('input');
        return;
      }

      // Try re-validation
      const result = await revalidateStoredLicense();
      if (result.success) {
        handleSuccess();
      } else {
        setPhase('input');
        setMessage({ text: 'License key expired atau sudah tidak valid. Masukkan key baru.', type: 'error' });
      }
    };

    checkStored();
  }, []);

  // Focus input when it appears
  useEffect(() => {
    if (phase === 'input' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [phase]);

  const handleSuccess = () => {
    setPhase('success');
    setIsFadingOut(true);
    setTimeout(() => {
      onAuthenticated();
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const key = licenseKey.trim();
    if (!key) {
      setMessage({ text: 'Masukkan license key terlebih dahulu.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: '', type: '' });

    const result = await activateLicense(key);
    setIsLoading(false);

    if (result.success) {
      setMessage({ text: result.message, type: 'success' });
      setTimeout(() => handleSuccess(), 800);
    } else {
      setMessage({ text: result.message, type: 'error' });
    }
  };

  return (
    <div className={`license-gate-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      {phase === 'checking' && (
        <div className="license-gate-validating">
          <div className="license-gate-validating-spinner"></div>
          <div className="license-gate-validating-text">Memverifikasi lisensi...</div>
        </div>
      )}

      {(phase === 'input' || phase === 'success') && (
        <div className="license-gate-card">
          {/* Icon */}
          <div className="license-gate-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="license-gate-title">senux Player</h1>
          <p className="license-gate-subtitle">Masukkan license key untuk mengakses aplikasi</p>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <div className="license-gate-input-wrap">
              <input
                ref={inputRef}
                type="text"
                className={`license-gate-input ${message.type === 'error' ? 'error' : ''} ${message.type === 'success' ? 'success' : ''}`}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={isLoading || phase === 'success'}
                autoComplete="off"
                spellCheck="false"
              />
              <svg className="license-gate-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <button
              type="submit"
              className="license-gate-btn"
              disabled={isLoading || phase === 'success'}
            >
              {isLoading ? (
                <>
                  <div className="license-gate-spinner"></div>
                  <span>Memvalidasi...</span>
                </>
              ) : phase === 'success' ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Berhasil!</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>Aktivasi</span>
                </>
              )}
            </button>
          </form>

          {/* Message */}
          {message.text && (
            <div className={`license-gate-message ${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Footer */}
          <div className="license-gate-footer">
            <div>senux Player v1.0 · Protected by KeyAuth</div>
            {hwid && (
              <div className="license-gate-hwid-text" style={{ fontSize: '10px', marginTop: '6px', opacity: 0.5, userSelect: 'all', fontFamily: 'monospace' }}>
                Device ID: {hwid}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
