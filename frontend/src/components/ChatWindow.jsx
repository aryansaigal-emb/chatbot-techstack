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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getSvgSize(svgElement) {
  const viewBox = svgElement.getAttribute('viewBox')?.split(/\s+/).map(Number)
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return {
      width: Math.max(Math.ceil(viewBox[2]), 1),
      height: Math.max(Math.ceil(viewBox[3]), 1),
    }
  }

  const rect = svgElement.getBoundingClientRect()
  return {
    width: Math.max(Math.ceil(rect.width), 1),
    height: Math.max(Math.ceil(rect.height), 1),
  }
}

function prepareSvgForDownload(svgElement) {
  const clone = svgElement.cloneNode(true)
  const { width, height } = getSvgSize(svgElement)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  background.setAttribute('x', '0')
  background.setAttribute('y', '0')
  background.setAttribute('width', '100%')
  background.setAttribute('height', '100%')
  background.setAttribute('fill', '#101616')
  clone.insertBefore(background, clone.firstChild)

  return {
    svgText: new XMLSerializer().serializeToString(clone),
    width,
    height,
  }
}

function MermaidDiagram({ code }) {
  const reactId = useId()
  const canvasRef = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [downloadError, setDownloadError] = useState('')

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

  function getRenderedSvg() {
    return canvasRef.current?.querySelector('svg')
  }

  function downloadSvg() {
    const svgElement = getRenderedSvg()
    if (!svgElement) {
      setDownloadError('Render the diagram before downloading.')
      return
    }

    const { svgText } = prepareSvgForDownload(svgElement)
    downloadBlob(
      new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }),
      `mermaid-diagram-${Date.now()}.svg`,
    )
    setDownloadError('')
  }

  function downloadPng() {
    const svgElement = getRenderedSvg()
    if (!svgElement) {
      setDownloadError('Render the diagram before downloading.')
      return
    }

    const { svgText, width, height } = prepareSvgForDownload(svgElement)
    const image = new Image()
    const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))

    image.onload = () => {
      const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3)
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale

      const context = canvas.getContext('2d')
      context.fillStyle = '#101616'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.scale(scale, scale)
      context.drawImage(image, 0, 0, width, height)

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(svgUrl)
        if (blob) {
          downloadBlob(blob, `mermaid-diagram-${Date.now()}.png`)
          setDownloadError('')
        } else {
          setDownloadError('Could not create PNG download.')
        }
      }, 'image/png')
    }

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      setDownloadError('Could not prepare PNG download.')
    }

    image.src = svgUrl
  }

  return (
    <div className="mermaid-card">
      <div className="mermaid-card-header">
        <span>Mermaid diagram</span>
        {svg && (
          <div className="mermaid-download-actions" aria-label="Diagram download options">
            <button type="button" onClick={downloadPng}>PNG</button>
            <button type="button" onClick={downloadSvg}>SVG</button>
          </div>
        )}
      </div>
      {svg ? (
        <div
          ref={canvasRef}
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
      {downloadError && <div className="mermaid-download-error">{downloadError}</div>}
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
          <p className="eyebrow">AI workspace</p>
          <h1>Intelligent chat assistant</h1>
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
