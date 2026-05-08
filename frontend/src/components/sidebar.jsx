import { useMemo, useRef, useState } from 'react'

function formatDate(value) {
  if (!value) return 'Just now'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function fileType(filename) {
  const extension = filename.split('.').pop()?.toUpperCase()
  return extension || 'DOC'
}

export default function Sidebar({
  uploadedFiles,
  onFileUpload,
  onNewChat,
  onSelectChat,
  onClearHistory,
  chatSessions,
  activeSessionId,
  uploading,
  userId,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState('history')
  const fileRef = useRef(null)

  const activeInitial = useMemo(() => userId.charAt(0).toUpperCase() || 'U', [userId])

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) onFileUpload(file)
    event.target.value = ''
  }

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">AI</div>
        <div>
          <div className="brand-name">EMB Global</div>
          <div className="brand-subtitle">RAG workspace</div>
        </div>
      </div>

      <div className="user-card">
        <div className="user-avatar">{activeInitial}</div>
        <div className="user-meta">
          <span>{userId}</span>
          <small>Signed in</small>
        </div>
        <button className="ghost-button small" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <button className="primary-action" type="button" onClick={onNewChat}>
        <span>+</span>
        New chat
      </button>

      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar tabs">
        <button
          className={activeTab === 'history' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          className={activeTab === 'files' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
      </div>

      <div className="sidebar-scroll">
        {activeTab === 'history' ? (
          <section className="sidebar-section">
            <div className="section-row">
              <h2>Chat history</h2>
              <button className="text-button" type="button" onClick={onClearHistory}>
                Clear
              </button>
            </div>

            {chatSessions.length === 0 ? (
              <div className="empty-state">Your saved conversations will appear here.</div>
            ) : (
              <div className="history-list">
                {chatSessions.map(session => (
                  <button
                    key={session.id}
                    className={`history-item ${session.id === activeSessionId ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => onSelectChat(session.id)}
                  >
                    <span className="history-title">{session.title}</span>
                    <span className="history-preview">{session.preview}</span>
                    <span className="history-time">{formatDate(session.updatedAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="sidebar-section">
            <div className="section-row">
              <h2>Knowledge base</h2>
              <span className="count-pill">{uploadedFiles.length}</span>
            </div>

            {uploadedFiles.length === 0 ? (
              <div className="empty-state">Upload documents to ground answers in your files.</div>
            ) : (
              <div className="file-list">
                {uploadedFiles.map(filename => (
                  <div className="file-item" key={filename}>
                    <span className="file-badge">{fileType(filename)}</span>
                    <span className="file-name">{filename}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="upload-panel">
        <div className="format-row">
          <span>.pdf</span>
          <span>.docx</span>
          <span>.xlsx</span>
          <span>images</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.pdf,.docx,.csv,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif"
          onChange={handleFileChange}
          hidden
        />
        <button
          className="upload-button"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Processing...' : 'Upload document'}
        </button>
      </div>
    </aside>
  )
}
