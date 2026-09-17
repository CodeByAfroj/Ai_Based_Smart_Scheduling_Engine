
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

  React.useEffect(() => {
    const handleClose = () => setIsChatOpen(false);
    window.addEventListener('close_chat', handleClose);
    return () => window.removeEventListener('close_chat', handleClose);
  }, []);

  const toggleChat = () => {
    setIsChatOpen((previous) => {
      if (!previous) {
        window.dispatchEvent(new Event('close_dropdowns'));
      }
      return !previous;
    });
  };

  const openChat = () => {
    setIsChatOpen(true);
    window.dispatchEvent(new Event('close_dropdowns'));
  };

  return (
    <>
      {/* Floating Chat Button - sits above mobile bottom nav */}
      <button
        type="button"
        onClick={toggleChat}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-4 lg:right-6 w-14 h-14 rounded-full bg-[var(--accent-base)] text-white flex items-center justify-center shadow-xl hover:scale-105 hover:opacity-90 transition-all duration-200 z-[99999]"
        title={isChatOpen ? 'Close Assistant' : 'Open Assistant (Say "Hey TaskPulse")'}
        aria-label={isChatOpen ? 'Close Assistant' : 'Open Assistant'}
      >
        {isChatOpen ? (
          <X size={22} />
        ) : (
          <Zap size={22} />
        )}
      </button>

      {/* Chat Window - full-screen on mobile, floating on desktop */}
      <div
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
          sm:rounded-2xl
          bg-white
          shadow-2xl
          border
          border-[var(--border-subtle)]
          overflow-hidden
          z-[99998]
          transition-all
          duration-300
          ${isChatOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none hidden'}
        `}
      >
        <ChatErrorBoundary>
          <ChatInterface isChatOpen={isChatOpen} openChat={openChat} />
        </ChatErrorBoundary>
      </div>
    </>
  );
}

