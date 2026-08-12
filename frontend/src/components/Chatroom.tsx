import { useState, useRef, useEffect } from 'react';
import { Send, Lock, MessageSquare } from 'lucide-react';

interface ChatMessage {
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

interface ChatroomProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isJoined: boolean;
  currentUserId: string;
}

export function Chatroom({
  messages,
  onSendMessage,
  isJoined,
  currentUserId
}: ChatroomProps) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !isJoined) return;
    onSendMessage(text.trim());
    setText('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
        <span className="text-xs font-bold text-white tracking-tight">Room Chat</span>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 mb-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-white/20 p-4">
            <MessageSquare className="w-5 h-5 mb-1.5 opacity-40" />
            <p className="text-[10px] font-semibold">No messages yet</p>
            <p className="text-[9px] mt-0.5 max-w-[160px]">Be the first to say something in this broadcast!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.userId === currentUserId;
            return (
              <div
                key={msg.timestamp + '-' + index}
                className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                {!isMe && (
                  <span className="text-[9px] text-white/30 font-bold mb-0.5 ml-1">
                    {msg.userName}
                  </span>
                )}
                <div
                  className={`px-3 py-1.5 rounded-2xl text-[11px] leading-snug break-words w-full ${
                    isMe
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-none'
                      : 'bg-white/5 text-white/80 border border-white/5 rounded-tl-none'
                  }`}
                  style={isMe ? { background: 'linear-gradient(135deg, var(--theme-accent) 0%, var(--theme-accent-hover) 100%)' } : {}}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input / Send Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!isJoined}
          placeholder={isJoined ? "Send a message..." : "Connect to broadcast..."}
          className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-white/10 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isJoined || !text.trim()}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition disabled:opacity-30"
          style={isJoined && text.trim() ? { backgroundColor: 'var(--theme-accent)', color: 'white' } : {}}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Locked Overlay when not joined */}
      {!isJoined && (
        <div className="absolute inset-0 bg-[#0a0d15]/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center z-10">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center mb-2 border border-white/5">
            <Lock className="w-4 h-4 text-white/40" />
          </div>
          <p className="text-[11px] font-bold text-white">Chatroom Locked</p>
          <p className="text-[9px] text-white/40 mt-1 max-w-[180px]">
            Only members inside an active broadcast room can chat.
          </p>
        </div>
      )}
    </div>
  );
}
