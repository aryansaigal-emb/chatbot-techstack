import { useRef } from 'react'

export default function Sidebar({ uploadedFiles, onFileUpload, onClearChat, uploading }) {
  const fileRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) onFileUpload(file)
    e.target.value = ''
  }

  // Show file type icon based on extension
  const getFileIcon = (filename) => {
    if (filename.endsWith('.pdf')) return '📕'
    if (filename.endsWith('.md')) return '📝'
    return '📄'
  }

  return (
    <div style={{
      width: '260px',
      background: '#111',
      borderRight: '1px solid #222',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
    }}>

      {/* Logo */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #1e1e1e',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: '#10a37f',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
        }}>
          🌿
        </div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '14px' }}>EMB Global</div>
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1.5px' }}>
            RAG CHATBOT
          </div>
        </div>
      </div>

      {/* New conversation */}
      <div style={{ padding: '12px' }}>
        <button
          onClick={onClearChat}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#bbb',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span>＋</span> New Conversation
        </button>
      </div>

      {/* Knowledge base label */}
      <div style={{
        padding: '8px 16px 4px',
        fontSize: '10px',
        color: '#444',
        letterSpacing: '2px',
        textTransform: 'uppercase',
      }}>
        Knowledge Base
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
        {uploadedFiles.length === 0 ? (
          <div style={{
            color: '#3a3a3a',
            fontSize: '12px',
            padding: '10px 4px',
            fontStyle: 'italic',
          }}>
            No files uploaded yet
          </div>
        ) : (
          uploadedFiles.map(filename => (
            <div
              key={filename}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                marginBottom: '2px',
                borderRadius: '6px',
                background: '#161616',
                fontSize: '12px',
                color: '#888',
              }}
            >
              <span style={{ flexShrink: 0 }}>{getFileIcon(filename)}</span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {filename}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Upload section */}
      <div style={{ padding: '12px', borderTop: '1px solid #1e1e1e' }}>

        {/* Supported formats label */}
        <div style={{
          fontSize: '10px',
          color: '#444',
          marginBottom: '8px',
          textAlign: 'center',
          letterSpacing: '1px',
        }}>
          SUPPORTED FORMATS
        </div>

        {/* Format badges */}
        <div style={{
          display: 'flex',
          gap: '6px',
          justifyContent: 'center',
          marginBottom: '10px',
        }}>
          {['PDF', 'TXT', 'MD'].map(fmt => (
            <span
              key={fmt}
              style={{
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '10px',
                color: '#666',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              .{fmt.toLowerCase()}
            </span>
          ))}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
         accept="*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Upload button */}
        <button
          onClick={() => fileRef.current.click()}
          disabled={uploading}
          style={{
            width: '100%',
            padding: '10px',
            background: uploading ? '#0a6e54' : '#10a37f',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            fontSize: '13px',
            transition: 'opacity 0.15s',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
          onMouseEnter={e => {
            if (!uploading) e.currentTarget.style.opacity = '0.85'
          }}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {uploading ? (
            <>
              <span style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }} />
              Processing...
            </>
          ) : (
            <>⬆ Upload Document</>
          )}
        </button>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Stack info */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #161616',
      }}>
        <div style={{
          fontSize: '10px',
          color: '#333',
          marginBottom: '6px',
          letterSpacing: '1px',
        }}>
          POWERED BY
        </div>
        {[
          'Claude Sonnet',
          'OpenRouter',
          'FastAPI',
          'FAISS + MiniLM',
          'pypdf',
        ].map(tool => (
          <div key={tool} style={{
            fontSize: '11px',
            color: '#3a3a3a',
            padding: '1px 0',
          }}>
            · {tool}
          </div>
        ))}
      </div>
    </div>
  )
}