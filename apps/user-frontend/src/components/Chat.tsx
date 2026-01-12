import { useState, useRef, useEffect } from 'react';
import { useGameStore, ChatMessage } from '@/store/game';
import { useAuthStore } from '@/store/auth';
import { useWebSocket } from '@/context/WebSocketContext';
import { Send, MessageCircle, X, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMessages = useGameStore((s) => s.chatMessages);
  const user = useAuthStore((s) => s.user);
  const { sendChatMessage } = useWebSocket();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    } else if (chatMessages.length > 0) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [chatMessages, isOpen]);

  // Reset unread count when opening
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (message.trim()) {
      sendChatMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300',
          isOpen
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30'
        )}
      >
        {isOpen ? (
          <ChevronDown className="w-6 h-6 text-gray-400" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-gray-900" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-scale-in"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 z-40 w-80 h-96 rounded-2xl overflow-hidden animate-slide-up"
          style={{
            background: 'linear-gradient(135deg, hsl(240 15% 10% / 0.98) 0%, hsl(240 15% 6% / 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid hsl(32 94% 44% / 0.2)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, hsl(240 15% 12%) 0%, hsl(240 15% 8%) 100%)',
              borderBottom: '1px solid hsl(32 94% 44% / 0.15)',
            }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 gold-text" />
              <span className="text-sm font-medium text-gray-200">Table Chat</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 h-[calc(100%-108px)]">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
                <p>No messages yet</p>
                <p className="text-xs">Start the conversation!</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  isOwn={msg.userId === user?.id}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className="p-3"
            style={{
              background: 'linear-gradient(135deg, hsl(240 15% 12%) 0%, hsl(240 15% 8%) 100%)',
              borderTop: '1px solid hsl(32 94% 44% / 0.15)',
            }}
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-800/80 border border-gray-700/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className={clsx(
                  'p-2 rounded-lg transition-all duration-200',
                  message.trim()
                    ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-gray-900 hover:shadow-lg hover:shadow-amber-500/30'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChatMessageItem({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  return (
    <div className={clsx('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-xl px-3 py-2',
          isOwn
            ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30'
            : 'bg-gray-800/60 border border-gray-700/50'
        )}
      >
        {!isOwn && (
          <div className="text-xs font-medium gold-text mb-0.5">
            {message.username}
          </div>
        )}
        <div className="text-sm text-gray-200 break-words">
          {message.message}
        </div>
        <div className="text-[10px] text-gray-500 mt-1 text-right">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
