import { useRef, useState } from 'react'

const SUGGESTIONS = [
  'Summarize the active document',
  'Extract the key decisions',
  'List deadlines and dates',
  'Find risks or blockers',
  'Create action items',
]

export default function InputBar({ onSend, loading, hasFiles }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const resizeTextarea = (element) => {
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`
  }

  const handleSend = () => {
    if (!text.trim() || loading) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleInput = (event) => {
    setText(event.target.value)
    resizeTextarea(event.target)
  }

  const canSend = text.trim().length > 0 && !loading

  return (
    <footer className="composer-shell">
      <div className="composer-inner">
        {!text && (
          <div className="suggestion-row">
            {SUGGESTIONS.map(suggestion => (
              <button
                className="suggestion-chip"
                key={suggestion}
                type="button"
                onClick={() => {
                  setText(suggestion)
                  textareaRef.current?.focus()
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className={`composer ${canSend ? 'can-send' : ''}`}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={hasFiles ? 'Ask a question about your documents...' : 'Upload a document or ask a general question...'}
            rows={1}
          />
          <button className="send-button" type="button" onClick={handleSend} disabled={!canSend}>
            Send
          </button>
        </div>

        <div className="composer-note">
          Answers are grounded in uploaded PDF, TXT, and MD files when available.
        </div>
      </div>
    </footer>
  )
}
