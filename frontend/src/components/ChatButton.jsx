
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

  const toggleChat = () => {
    setIsChatOpen((previous) => !previous);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        type="button"
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--accent-base)] text-white flex items-center justify-center shadow-xl hover:scale-105 hover:opacity-90 transition-all duration-200 z-[99999]"
        title={isChatOpen ? 'Close Assistant' : 'Open Assistant'}
        aria-label={isChatOpen ? 'Close Assistant' : 'Open Assistant'}
      >
        {isChatOpen ? (
          <X size={22} />
        ) : (
          <Zap size={22} />
        )}
      </button>

      {/* Chat Window */}
      {isChatOpen && (
        <div
          className="
            fixed
            bottom-24
            right-6
            w-[calc(100vw-3rem)]
            sm:w-[420px]
            max-w-[420px]
            h-[600px]
            max-h-[calc(100vh-8rem)]
            bg-white
            rounded-2xl
            shadow-2xl
            border
            border-[var(--border-subtle)]
            overflow-hidden
            z-[99998]
          "
        >
          <ChatErrorBoundary>
            <ChatInterface />
          </ChatErrorBoundary>
        </div>
      )}
    </>
  );
}

