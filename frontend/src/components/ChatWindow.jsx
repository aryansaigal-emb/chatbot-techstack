import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Streamdown } from 'streamdown'
import mermaid from 'mermaid'
import 'streamdown/styles.css'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  flowchart: { htmlLabels: false, curve: 'basis' },
  sequence: { mirrorActors: false },
})

function SourceBadge({ source }) {
  const label = source.split('/').pop()
  return (
    <span className="source-badge">
      <span>Source</span>
      {label}
    </span>
  )
}

function ThinkingDots() {
  return (
    <div className="thinking-dots" aria-label="Assistant is thinking">
      <span />
      <span />
      <span />
    </div>
  )
}

function UserText({ text }) {
  return text.split('\n').map((line, index, lines) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 && <br />}
    </span>
  ))
}

function splitMermaidBlocks(content) {
  const parts = []
  const pattern = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/gi
  let lastIndex = 0
  let match

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'markdown', value: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mermaid', value: match[1].trim() })
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'markdown', value: content.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'markdown', value: content }]
}

function MermaidDiagram({ code }) {
  const reactId = useId()
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`

    async function renderDiagram() {
      try {
        await mermaid.parse(code)
        const result = await mermaid.render(id, code)
        if (!cancelled) {
          setSvg(result.svg)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setSvg('')
          setError(err?.message || 'Could not render Mermaid diagram.')
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [code, reactId])

  return (
    <div className="mermaid-card">
      <div className="mermaid-card-header">
        <span>Mermaid diagram</span>
      </div>
      {svg ? (
        <div
          className="mermaid-canvas"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="mermaid-error">
          <strong>Diagram render failed.</strong>
          <span>{error}</span>
          <pre>{code}</pre>
        </div>
      )}
    </div>
  )
}

function AssistantContent({ content, loading }) {
  const parts = useMemo(() => splitMermaidBlocks(content), [content])

  return (
    <>
      {parts.map((part, index) => (
        part.type === 'mermaid' ? (
          <MermaidDiagram key={`mermaid-${index}-${part.value.slice(0, 18)}`} code={part.value} />
        ) : part.value.trim() ? (
          <Streamdown key={`markdown-${index}`} isAnimating={loading}>{part.value}</Streamdown>
        ) : null
      ))}
    </>
  )
}

function MessageContent({ msg, loading }) {
  if (msg.role === 'assistant') {
    return (
      <div className="streamdown-message">
        <AssistantContent content={msg.content} loading={loading} />
      </div>
    )
  }

  return <UserText text={msg.content} />
}

export default function ChatWindow({ messages, loading, userId, uploadedFiles }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <section className="chat-shell">
      <header className="chat-topbar">
        <div>
          <p className="eyebrow">Document assistant</p>
          <h1>Ask your knowledge base</h1>
        </div>
        <div className="status-cluster" aria-label="Workspace status">
          <span>{uploadedFiles.length} files</span>
          <span>{messages.filter(message => message.role === 'user').length} questions</span>
          <span>{userId}</span>
        </div>
      </header>

      <div className="chat-scroll">
        <div className="message-stack">
          {messages.map((msg, index) => (
            <article
              className={`message-row ${msg.role === 'user' ? 'from-user' : 'from-assistant'}`}
              key={`${msg.role}-${index}-${msg.content.slice(0, 20)}`}
            >
              <div className="message-avatar">{msg.role === 'user' ? 'You' : 'AI'}</div>
              <div className="message-body">
                <div className="message-label">{msg.role === 'user' ? 'You' : 'EMB Assistant'}</div>
                <div className="message-bubble">
                  <MessageContent msg={msg} loading={loading && index === messages.length - 1} />
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="source-row">
                    <span>{msg.chunksUsed} chunk{msg.chunksUsed !== 1 ? 's' : ''} retrieved</span>
                    {msg.sources.map(source => (
                      <SourceBadge key={source} source={source} />
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}

          {loading && (
            <article className="message-row from-assistant">
              <div className="message-avatar">AI</div>
              <div className="message-body">
                <div className="message-label">EMB Assistant</div>
                <div className="message-bubble compact">
                  <ThinkingDots />
                </div>
              </div>
            </article>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </section>
  )
}
