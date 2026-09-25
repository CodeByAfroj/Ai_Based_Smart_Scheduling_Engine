
import React, { useState } from 'react';
import ChatInterface from './ChatInterface.jsx';
import { Zap, X } from 'lucide-react';

class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ChatInterface crashed:', error);
    console.error('ChatInterface error details:', errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <div className="text-red-500 text-3xl mb-3">
            ⚠️
          </div>

          <h3 className="font-semibold text-gray-800 mb-2">
            Assistant could not load
          </h3>

          <p className="text-sm text-gray-500 mb-4">
            There is an error inside ChatInterface.
          </p>

          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg bg-[var(--accent-base)] text-white hover:opacity-90"
          >
            Try Again
          </button>

          {this.state.error?.message && (
            <p className="mt-4 text-xs text-red-500 break-words">
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const STRIPS = 30;
const DURATION = 450;
const MAXDELAY = 220;

function runGenie(win, target, reverse) {
  if (!win || !target) return;
  const wRect = win.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  
  const dx = (tRect.left + tRect.width/2)  - (wRect.left + wRect.width/2);
  const dy = (tRect.top  + tRect.height/2) - (wRect.top  + wRect.height/2);

  const layer = document.createElement('div');
  layer.id = 'genie-layer';
  layer.style.position = 'fixed';
  layer.style.top = '0';
  layer.style.left = '0';
  layer.style.width = '100vw';
  layer.style.height = '100vh';
  layer.style.pointerEvents = 'none';
  layer.style.zIndex = '100000';
  document.body.appendChild(layer);

  // Force the real window to be invisible during animation
  win.style.visibility = 'hidden';

  for (let i = 0; i < STRIPS; i++) {
    const topPct = (i / STRIPS) * 100;
    const botPct = 100 - ((i + 1) / STRIPS) * 100;
    const clone = win.cloneNode(true);
    // Remove ids from clone to prevent duplicates, and ensure it's visible
    clone.removeAttribute('id');
    clone.style.visibility = 'visible';
    clone.style.display = 'block';
    clone.style.opacity = '1';
    
    clone.className = 'genie-strip' + (reverse ? ' reverse' : '');
    clone.style.left = wRect.left + 'px';
    clone.style.top  = wRect.top  + 'px';
    clone.style.width  = wRect.width  + 'px';
    clone.style.height = wRect.height + 'px';
    clone.style.clipPath = `inset(${topPct}% 0 ${botPct}% 0)`;
    
    const bandCenterPct = (topPct + (100 - botPct)) / 2;
    clone.style.transformOrigin = `50% ${bandCenterPct}%`;
    const delay = MAXDELAY * (1 - i / (STRIPS - 1));
    clone.style.setProperty('--dx', dx + 'px');
    clone.style.setProperty('--dy', dy + 'px');
    clone.style.animationDuration = DURATION + 'ms';
    clone.style.animationDelay = delay + 'ms';
    layer.appendChild(clone);
  }

  setTimeout(() => {
    layer.remove();
    if (reverse) {
      win.style.visibility = 'visible';
    }
  }, DURATION + MAXDELAY + 50);
}

export default function ChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapseTimerRef = React.useRef(null);
  const chatWindowRef = React.useRef(null);
  const chatButtonRef = React.useRef(null);

  const startCollapseTimer = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setIsCollapsed(true);
    }, 2000);
  };

  React.useEffect(() => {
    // On mount, wait 2 seconds then collapse
    startCollapseTimer();
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const handleClose = () => {
      if (chatWindowRef.current && chatButtonRef.current && isChatOpen) {
        runGenie(chatWindowRef.current, chatButtonRef.current, false);
      }
      setIsChatOpen(false);
      startCollapseTimer();
    };
    window.addEventListener('close_chat', handleClose);
    return () => window.removeEventListener('close_chat', handleClose);
  }, [isChatOpen]);

  const toggleChat = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    
    if (isCollapsed && !isChatOpen) {
      // First click: just un-collapse the button and restart the timer
      setIsCollapsed(false);
      startCollapseTimer();
      return;
    }
    
    setIsChatOpen((previous) => {
      if (!previous) {
        window.dispatchEvent(new Event('close_dropdowns'));
        setIsCollapsed(false);
        // Run open genie
        requestAnimationFrame(() => {
          if (chatWindowRef.current && chatButtonRef.current) {
            runGenie(chatWindowRef.current, chatButtonRef.current, true);
          }
        });
      } else {
        if (chatWindowRef.current && chatButtonRef.current) {
          runGenie(chatWindowRef.current, chatButtonRef.current, false);
        }
        startCollapseTimer();
      }
      return !previous;
    });
  };

  const openChat = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    setIsChatOpen(true);
    setIsCollapsed(false);
    window.dispatchEvent(new Event('close_dropdowns'));
    
    requestAnimationFrame(() => {
      if (chatWindowRef.current && chatButtonRef.current) {
        runGenie(chatWindowRef.current, chatButtonRef.current, true);
      }
    });
  };

  const closeChat = () => {
    if (chatWindowRef.current && chatButtonRef.current) {
      runGenie(chatWindowRef.current, chatButtonRef.current, false);
    }
    setIsChatOpen(false);
    startCollapseTimer();
  };

  return (
    <>
      <style>{`
        .genie-strip {
          position: fixed;
          z-index: 100000;
          pointer-events: none;
          animation-name: genieSuck;
          animation-timing-function: ease-in-out;
          animation-fill-mode: both;
          will-change: transform, opacity;
          backface-visibility: hidden;
          transform: translateZ(0);
        }
        .genie-strip.reverse {
          animation-direction: reverse;
        }
        @keyframes genieSuck {
          0%   { 
            transform: translate3d(0,0,0) scale(1,1); 
            opacity: 1; 
          }
          30%  { 
            transform: translate3d(calc(var(--dx)*0.2), calc(var(--dy)*0.3), 0) scale(0.9, 0.9); 
            opacity: 1; 
          }
          60%  { 
            transform: translate3d(calc(var(--dx)*0.5), calc(var(--dy)*0.6), 0) scale(0.6, 0.6); 
            opacity: 1; 
          }
          85%  { 
            transform: translate3d(calc(var(--dx)*0.85), calc(var(--dy)*0.85), 0) scale(0.15, 0.25); 
            opacity: 0.8; 
          }
          100% { 
            transform: translate3d(var(--dx), var(--dy), 0) scale(0, 0); 
            opacity: 0; 
          }
        }
      `}</style>

      {/* Floating Chat Button - sits above mobile bottom nav */}
      <button
        ref={chatButtonRef}
        type="button"
        data-tour="ai-assistant"
        onClick={toggleChat}
        className={`
          fixed z-[99999] shadow-xl bg-[var(--accent-base)] text-white border border-white/20
          transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center
          ${isChatOpen ? 'opacity-0 scale-95 pointer-events-none' : ''}
          ${isCollapsed && !isChatOpen 
            ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-0 w-14 h-14 rounded-l-full translate-x-7 opacity-70 hover:opacity-100' 
            : 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-4 lg:right-6 w-14 h-14 rounded-full hover:scale-105 hover:opacity-100'}
        `}
        title={isChatOpen ? 'Close Assistant' : 'Open Assistant (Say "Hey TaskPulse")'}
        aria-label={isChatOpen ? 'Close Assistant' : 'Open Assistant'}
      >
        <Zap 
          size={22} 
          className="transition-all duration-300"
        />
      </button>

      {/* Chat Window - full-screen on mobile, floating on desktop */}
      <div
        ref={chatWindowRef}
        className={`
          fixed
          bottom-0 right-0
          w-full h-[100dvh]
          sm:bottom-[calc(4rem+2.5rem)] sm:right-6
          lg:bottom-24
          sm:w-[420px]
          sm:max-w-[420px]
          sm:h-[600px]
          sm:max-h-[calc(100vh-8rem)]
          bg-white
          shadow-[0_20px_60px_rgba(0,0,0,0.3)]
          border
          border-[var(--border-subtle)]
          overflow-hidden
          z-[99998]
          ${isChatOpen 
            ? 'opacity-100 pointer-events-auto rounded-none sm:rounded-2xl' 
            : 'opacity-0 pointer-events-none'}
        `}
      >
        <ChatErrorBoundary>
          <ChatInterface isChatOpen={isChatOpen} openChat={openChat} closeChat={closeChat} />
        </ChatErrorBoundary>
      </div>
    </>
  );
}

