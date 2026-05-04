import { useEffect, useRef } from 'react'

function SourceBadge({ source }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: 'rgba(16,163,127,0.1)', color: '#10a37f',
      border: '1px solid rgba(16,163,127,0.25)',
      borderRadius: '6px', padding: '2px 8px',
      fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '600',
    }}>
      📄 {source}
    </span>
  )
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#10a37f',
          animation: 'thinking 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`
        @keyframes thinking {
          0%, 80%, 100% { opacity: 0.15; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.0); }
        }
      `}</style>
    </div>
  )
}

function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.07);padding:2px 6px;border-radius:4px;font-size:0.87em">$1</code>')
    .replace(/\n/g, '<br/>')
}

export default function ChatWindow({ messages, loading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            gap: '12px', alignItems: 'flex-start', marginBottom: '28px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: msg.role === 'user' ? '#2a2a2a' : '#10a37f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: '700', flexShrink: 0, color: 'white',
            }}>
              {msg.role === 'user' ? 'U' : '🌿'}
            </div>

            <div style={{ maxWidth: '80%' }}>
              <div
                style={{
                  background: msg.role === 'user' ? '#1e3a2f' : '#1a1a1a',
                  border: `1px solid ${msg.role === 'user' ? '#2a5a40' : '#2a2a2a'}`,
                  borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                  padding: '13px 17px', fontSize: '14px',
                  lineHeight: '1.7', color: '#e0e0e0',
                }}
                dangerouslySetInnerHTML={{ __html: formatText(msg.content) }}
              />

              {msg.sources && msg.sources.length > 0 && (
                <div style={{
                  marginTop: '8px', display: 'flex',
                  flexWrap: 'wrap', gap: '6px',
                  alignItems: 'center', paddingLeft: '4px',
                }}>
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    {msg.chunksUsed} chunk{msg.chunksUsed !== 1 ? 's' : ''} retrieved ·
                  </span>
                  {msg.sources.map(s => <SourceBadge key={s} source={s} />)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{
            display: 'flex', gap: '12px',
            alignItems: 'flex-start', marginBottom: '28px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: '#10a37f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', flexShrink: 0,
            }}>🌿</div>
            <div style={{
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: '4px 18px 18px 18px', padding: '13px 17px',
            }}>
              <ThinkingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}