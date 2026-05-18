import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface ChatMessage {
  fromUsername: string;
  fromSeat: number | null;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  /** Whether the panel is currently expanded */
  expanded?: boolean;
}

export function ChatPanel({ messages, onSend, expanded: initialExpanded }: ChatPanelProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(initialExpanded ?? false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    } else if (messages.length > prevCountRef.current) {
      setUnreadCount((c) => c + (messages.length - prevCountRef.current));
    }
    prevCountRef.current = messages.length;
  }, [messages.length, expanded]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      zIndex: 100,
      width: expanded ? 320 : 'auto',
    }}>
      {/* Toggle button */}
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) setUnreadCount(0);
        }}
        style={{
          background: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: expanded ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: expanded ? '100%' : 'auto',
        }}
      >
        {t('chat.title')}
        {unreadCount > 0 && !expanded && (
          <span style={{
            background: 'var(--color-danger)',
            color: '#fff',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            fontWeight: 'bold',
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {expanded && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 var(--radius) var(--radius)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Messages */}
          <div style={{
            height: 200,
            overflowY: 'auto',
            padding: '0.5rem',
            fontSize: '0.8rem',
          }}>
            {messages.length === 0 && (
              <p style={{ color: 'var(--color-muted)', textAlign: 'center', marginTop: '2rem' }}>
                {t('chat.noMessages')}
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: '0.35rem' }}>
                <strong style={{ color: 'var(--color-accent)' }}>{msg.fromUsername}:</strong>{' '}
                <span>{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            display: 'flex',
            borderTop: '1px solid var(--color-border)',
            padding: '0.35rem',
            gap: '0.35rem',
          }}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('chat.placeholder')}
              maxLength={200}
              style={{ flex: 1, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
            >
              {t('chat.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
