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

export default function ChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapseTimerRef = React.useRef(null);

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
      setIsChatOpen(false);
      startCollapseTimer();
    };
    window.addEventListener('close_chat', handleClose);
    return () => window.removeEventListener('close_chat', handleClose);
  }, []);

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
      } else {
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
  };

  const closeChat = () => {
    setIsChatOpen(false);
    startCollapseTimer();
  };

  return (
    <>
      {/* Floating Chat Button - hidden on mobile (md:flex only) */}
      <button
        type="button"
        data-tour="ai-assistant"
        onClick={toggleChat}
        className={`
          hidden md:flex
          fixed z-[99999] shadow-xl bg-[var(--accent-base)] text-white border border-white/20
          transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center
          ${isChatOpen ? 'opacity-0 scale-95 pointer-events-none' : ''}
          ${isCollapsed && !isChatOpen 
            ? 'bottom-6 right-0 w-14 h-14 rounded-l-full translate-x-7 opacity-70 hover:opacity-100' 
            : 'bottom-6 right-6 w-14 h-14 rounded-full hover:scale-105 hover:opacity-100'}
        `}
        title={isChatOpen ? 'Close Assistant' : 'Open Assistant (Say "Hey TaskPulse")'}
        aria-label={isChatOpen ? 'Close Assistant' : 'Open Assistant'}
      >
        <Zap 
          size={22} 
          className="transition-all duration-300"
        />
      </button>

      {/* Chat Window - hidden on mobile, floating on desktop */}
      <div
        className={`
          hidden md:block
          fixed
          bottom-24 right-6
          w-[420px]
          h-[600px]
          max-h-[calc(100vh-8rem)]
          bg-white
          shadow-[0_20px_60px_rgba(0,0,0,0.3)]
          border
          border-[var(--border-subtle)]
          rounded-2xl
          overflow-hidden
          z-[99998]
          origin-bottom-right
          transition-all
          duration-300
          ease-[cubic-bezier(0.175,0.885,0.32,1.15)]
          ${isChatOpen 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-50 pointer-events-none translate-y-20 translate-x-10'}
        `}
      >
        <ChatErrorBoundary>
          <ChatInterface isChatOpen={isChatOpen} openChat={openChat} closeChat={closeChat} />
        </ChatErrorBoundary>
      </div>
    </>
  );
}
