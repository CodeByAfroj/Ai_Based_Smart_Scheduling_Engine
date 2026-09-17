import { useState, useEffect } from 'react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Check if user already dismissed this session
    if (sessionStorage.getItem('pwa-install-dismissed')) {
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show the banner after a short delay
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showBanner || isInstalled || dismissed || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-tour-active') === 'true')) return null;

  return (
    <div
      id="pwa-install-banner"
      role="banner"
      aria-label="Install app banner"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(420px, calc(100vw - 32px))',
        animation: 'pwa-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(40px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pwa-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%       { transform: scale(1.15); opacity: 0.15; }
        }
        #pwa-install-banner .pwa-icon-ring {
          animation: pwa-pulse-ring 2.4s ease-in-out infinite;
        }
        #pwa-install-banner .pwa-install-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.45);
        }
        #pwa-install-banner .pwa-dismiss-btn:hover {
          background: rgba(255,255,255,0.08);
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,27,75,0.97) 100%)',
        border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: '20px',
        padding: '20px 20px 18px',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
      }}>
        {/* Icon */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div className="pwa-icon-ring" style={{
            position: 'absolute',
            inset: '-6px',
            borderRadius: '18px',
            background: 'rgba(99,102,241,0.2)',
            border: '1.5px solid rgba(99,102,241,0.4)',
          }} />
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
        </div>

        {/* Text + actions */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: '14.5px',
            fontWeight: 700,
            color: '#f1f5f9',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}>
            Install TaskPulse
          </p>
          <p style={{
            margin: '4px 0 14px',
            fontSize: '12.5px',
            color: 'rgba(148,163,184,0.9)',
            lineHeight: 1.5,
          }}>
            Add to your home screen for a faster, offline-ready experience.
          </p>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              id="pwa-install-btn"
              className="pwa-install-btn"
              onClick={handleInstall}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                letterSpacing: '-0.01em',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              }}
            >
              Install App
            </button>
            <button
              id="pwa-dismiss-btn"
              className="pwa-dismiss-btn"
              onClick={handleDismiss}
              style={{
                background: 'transparent',
                color: 'rgba(148,163,184,0.8)',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              Not now
            </button>
          </div>
        </div>

        {/* Close X */}
        <button
          id="pwa-close-btn"
          onClick={handleDismiss}
          aria-label="Close install banner"
          style={{
            flexShrink: 0,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(148,163,184,0.7)',
            marginTop: '-2px',
            transition: 'background 0.18s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
