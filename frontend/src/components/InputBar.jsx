import { useState, useRef } from 'react'

const SUGGESTIONS = [
  'What is this document about?',
  'Summarize the key points',
  'What are the main conclusions?',
  'List all important dates mentioned',
  'Who are the key people mentioned?',
]

export default function InputBar({ onSend, loading }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    if (!text.trim() || loading) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const canSend = text.trim().length > 0 && !loading

  return (
    <div style={{
      background: '#111',
      borderTop: '1px solid #1e1e1e',
      padding: '16px 24px 20px',
    }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Suggestion chips */}
        {!text && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => {
                  setText(s)
                  textareaRef.current?.focus()
                }}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '20px',
                  padding: '5px 13px',
                  fontSize: '12px',
                  color: '#666',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#10a37f'
                  e.currentTarget.style.color = 'white'
                  e.currentTarget.style.borderColor = '#10a37f'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#1a1a1a'
                  e.currentTarget.style.color = '#666'
                  e.currentTarget.style.borderColor = '#2a2a2a'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '14px',
          padding: '10px 14px',
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e8e8e8',
              fontSize: '14px',
              lineHeight: '1.5',
              resize: 'none',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: canSend ? '#10a37f' : '#2a2a2a',
              border: 'none',
              color: canSend ? 'white' : '#555',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            ↑
          </button>
        </div>

        <div style={{
          fontSize: '11px',
          color: '#2a2a2a',
          textAlign: 'center',
          marginTop: '8px',
        }}>
         EMB RAG Chatbot · Llama 3.1 via Groq · PDF, TXT, MD supported · Free AI
        </div>
      </div>
    </div>
  )
}