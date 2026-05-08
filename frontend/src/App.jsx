import { useState, useCallback, useEffect, useRef } from 'react'
import Login from './login.jsx'
import Sidebar from './components/sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import InputBar from './components/InputBar.jsx'
import { API_HEADERS, apiUrl } from './api.js'
import './App.css'

const CHAT_MESSAGES_KEY = 'chat_messages'
const CHAT_HISTORY_KEY = 'chat_history'
const CHAT_SESSIONS_KEY = 'chat_sessions'
const MAX_HISTORY_ITEMS = 20
const MAX_SESSIONS = 30

const makeId = () => `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`

const welcomeMessage = (name, returning = false) => ({
  role: 'assistant',
  content: returning
    ? `Welcome back **${name}**.\n\nAsk a question, continue a conversation, or bring in files and tools whenever you need more context.`
    : `Welcome **${name}**.\n\nStart with a question, explore an idea, or add files when you want the assistant to work with extra context.`,
  sources: [],
  chunksUsed: 0,
})

function isLegacyWelcomeMessage(message) {
  if (message?.role !== 'assistant' || !message?.content) return false
  return (
    message.content.startsWith('Welcome ') ||
    message.content.startsWith('Welcome back ') ||
    message.content.includes('Upload a document, spreadsheet, slide deck, or image') ||
    message.content.includes('Upload a document or ask me anything about it') ||
    message.content.includes('Ask me anything about your documents')
  )
}

function refreshWelcomeMessages(messages, name, returning = true) {
  if (!Array.isArray(messages) || messages.length === 0) return messages

  return messages.map((message, index) => {
    if (index === 0 && isLegacyWelcomeMessage(message)) {
      return welcomeMessage(name, returning)
    }
    return message
  })
}

function getSavedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function getConversationTitle(messages) {
  const firstQuestion = messages.find(message => message.role === 'user')?.content
  if (!firstQuestion) return 'New conversation'
  return firstQuestion.length > 48 ? `${firstQuestion.slice(0, 48)}...` : firstQuestion
}

function getConversationPreview(messages) {
  const lastMessage = [...messages].reverse().find(message => message.content)
  if (!lastMessage) return 'No messages yet'
  const clean = lastMessage.content.replace(/\s+/g, ' ').trim()
  return clean.length > 72 ? `${clean.slice(0, 72)}...` : clean
}

function getBackendHistory(messages) {
  return messages
    .filter(message => ['user', 'assistant'].includes(message.role))
    .filter(message => message.content && !message.content.startsWith('Welcome '))
    .map(({ role, content }) => ({ role, content }))
    .slice(-MAX_HISTORY_ITEMS)
}

export default function App() {
  const [token, setToken] = useState(null)
  const [userId, setUserId] = useState('')
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [chatSessions, setChatSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [memoryLoaded, setMemoryLoaded] = useState(false)
  const memorySaveTimerRef = useRef(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
    const savedUserId = localStorage.getItem('user_id')
    const savedMessages = getSavedArray(CHAT_MESSAGES_KEY)
    const savedHistory = getSavedArray(CHAT_HISTORY_KEY)
    const savedSessions = getSavedArray(CHAT_SESSIONS_KEY)

    if (savedToken && savedUserId) {
      const initialMessages = savedMessages.length > 0
        ? refreshWelcomeMessages(savedMessages, savedUserId, true)
        : [welcomeMessage(savedUserId, true)]
      const fallbackSession = {
        id: makeId(),
        title: getConversationTitle(initialMessages),
        preview: getConversationPreview(initialMessages),
        messages: initialMessages,
        updatedAt: Date.now(),
      }
      const sessions = savedSessions.length > 0 ? savedSessions : [fallbackSession]
      const refreshedSessions = sessions.map(session => ({
        ...session,
        messages: refreshWelcomeMessages(session.messages || [], savedUserId, true),
      }))
      const activeId = sessions[0]?.id || fallbackSession.id

      setToken(savedToken)
      setUserId(savedUserId)
      setMessages(refreshedSessions.find(session => session.id === activeId)?.messages || initialMessages)
      setHistory(savedHistory.slice(-MAX_HISTORY_ITEMS))
      setChatSessions(refreshedSessions.slice(0, MAX_SESSIONS))
      setActiveSessionId(activeId)
    }
  }, [])

  useEffect(() => {
    if (!token || !userId) {
      setMemoryLoaded(false)
      return
    }

    let cancelled = false

    async function loadMemory() {
      try {
        const res = await fetch(apiUrl('/memory'), {
          headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        })

        if (!res.ok) return

        const data = await res.json()
        const dbSessions = Array.isArray(data.sessions) ? data.sessions : []
        const dbHistory = Array.isArray(data.history) ? data.history : []

        if (!cancelled && dbSessions.length > 0) {
          const activeId = data.active_session_id || dbSessions[0].id
          const refreshedSessions = dbSessions.map(session => ({
            ...session,
            messages: refreshWelcomeMessages(session.messages || [], userId, true),
          }))
          const activeSession = refreshedSessions.find(session => session.id === activeId) || refreshedSessions[0]

          setChatSessions(refreshedSessions.slice(0, MAX_SESSIONS))
          setActiveSessionId(activeSession.id)
          setMessages(activeSession.messages || [welcomeMessage(userId, true)])
          setHistory(dbHistory.slice(-MAX_HISTORY_ITEMS))
          localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(refreshedSessions.slice(0, MAX_SESSIONS)))
          localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(activeSession.messages || []))
          localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(dbHistory.slice(-MAX_HISTORY_ITEMS)))
        }
      } catch {
        // Browser storage remains the fallback when database memory is unavailable.
      } finally {
        if (!cancelled) setMemoryLoaded(true)
      }
    }

    loadMemory()

    return () => {
      cancelled = true
    }
  }, [token, userId])

  useEffect(() => {
    if (token && messages.length > 0) {
      localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages))
    }
  }, [messages, token])

  useEffect(() => {
    if (token) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY_ITEMS)))
    }
  }, [history, token])

  useEffect(() => {
    if (token && chatSessions.length > 0) {
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(chatSessions.slice(0, MAX_SESSIONS)))
    }
  }, [chatSessions, token])

  useEffect(() => {
    if (!token || !memoryLoaded || chatSessions.length === 0) return

    if (memorySaveTimerRef.current) {
      clearTimeout(memorySaveTimerRef.current)
    }

    memorySaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(apiUrl('/memory'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...API_HEADERS,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessions: chatSessions.slice(0, MAX_SESSIONS),
            active_session_id: activeSessionId,
            history: history.slice(-MAX_HISTORY_ITEMS),
          }),
        })
      } catch {
        // Local storage already has the latest chat if the database write fails.
      }
    }, 600)

    return () => {
      if (memorySaveTimerRef.current) {
        clearTimeout(memorySaveTimerRef.current)
      }
    }
  }, [activeSessionId, chatSessions, history, memoryLoaded, token])

  useEffect(() => {
    if (!token || !activeSessionId || messages.length === 0) return

    setChatSessions(prev => {
      const nextSession = {
        id: activeSessionId,
        title: getConversationTitle(messages),
        preview: getConversationPreview(messages),
        messages,
        updatedAt: Date.now(),
      }
      const withoutCurrent = prev.filter(session => session.id !== activeSessionId)
      return [nextSession, ...withoutCurrent].slice(0, MAX_SESSIONS)
    })
  }, [activeSessionId, messages, token])

  const handleLogin = (newToken, newUserId) => {
    const newMessages = [welcomeMessage(newUserId)]
    const newSession = {
      id: makeId(),
      title: 'New conversation',
      preview: 'Ready for your first question',
      messages: newMessages,
      updatedAt: Date.now(),
    }

    setToken(newToken)
    setUserId(newUserId)
    setMessages(newMessages)
    setHistory([])
    setChatSessions([newSession])
    setActiveSessionId(newSession.id)
    setMemoryLoaded(false)
    localStorage.removeItem(CHAT_MESSAGES_KEY)
    localStorage.removeItem(CHAT_HISTORY_KEY)
    localStorage.removeItem(CHAT_SESSIONS_KEY)
  }

  const handleLogout = useCallback(async () => {
    try {
      await fetch(apiUrl('/logout'), {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
      })
    } catch {
      // Logging out locally should still work if the API is unavailable.
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_id')
    localStorage.removeItem(CHAT_MESSAGES_KEY)
    localStorage.removeItem(CHAT_HISTORY_KEY)
    localStorage.removeItem(CHAT_SESSIONS_KEY)
    setToken(null)
    setUserId('')
    setMessages([])
    setHistory([])
    setChatSessions([])
    setActiveSessionId('')
    setMemoryLoaded(false)
    setUploadedFiles([])
  }, [token])

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || loading) return

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userText, sources: [], chunksUsed: 0 },
    ])
    setLoading(true)

    try {
      const res = await fetch(apiUrl('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...API_HEADERS,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userText,
          history,
          top_k: 4,
        }),
      })

      if (res.status === 401) {
        handleLogout()
        return
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Server error')
      }

      const data = await res.json()

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          chunksUsed: data.chunks_used || 0,
        },
      ])

      setHistory(prev => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: data.answer },
      ].slice(-MAX_HISTORY_ITEMS))
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message}`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [history, loading, token, handleLogout])

  const handleFileUpload = useCallback(async (file) => {
    setUploading(true)
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `Uploading **${file.name}**...`,
        sources: [],
        chunksUsed: 0,
      },
    ])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(apiUrl('/ingest/file'), {
        method: 'POST',
        headers: {
          ...API_HEADERS,
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (res.status === 401) {
        handleLogout()
        return
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Upload failed')
      }

      const data = await res.json()
      setUploadedFiles(prev => [...new Set([...prev, file.name])])
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: `**${file.name}** uploaded.\n${data.message}\n\nNow ask me anything about it.`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: `Upload failed: ${err.message}`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } finally {
      setUploading(false)
    }
  }, [token, handleLogout])

  const startNewChat = useCallback(() => {
    const newMessages = [{
      role: 'assistant',
      content: 'New chat started. Ask a question, explore an idea, or add files when extra context would help.',
      sources: [],
      chunksUsed: 0,
    }]
    const newSessionId = makeId()

    setActiveSessionId(newSessionId)
    setMessages(newMessages)
    setHistory([])
    localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(newMessages))
    localStorage.removeItem(CHAT_HISTORY_KEY)
  }, [])

  const selectChat = useCallback((sessionId) => {
    const session = chatSessions.find(item => item.id === sessionId)
    if (!session) return
    setActiveSessionId(session.id)
    const refreshedMessages = refreshWelcomeMessages(session.messages, userId, true)
    setMessages(refreshedMessages)
    setHistory(getBackendHistory(refreshedMessages))
  }, [chatSessions, userId])

  const clearAllChats = useCallback(() => {
    const newMessages = [welcomeMessage(userId, true)]
    const newSession = {
      id: makeId(),
      title: 'New conversation',
      preview: 'History cleared',
      messages: newMessages,
      updatedAt: Date.now(),
    }

    setActiveSessionId(newSession.id)
    setMessages(newMessages)
    setHistory([])
    setChatSessions([newSession])
    localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(newMessages))
    localStorage.removeItem(CHAT_HISTORY_KEY)
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify([newSession]))

    fetch(apiUrl('/memory'), {
      method: 'DELETE',
      headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }, [token, userId])

  if (!token) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app-container">
      <Sidebar
        uploadedFiles={uploadedFiles}
        onFileUpload={handleFileUpload}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        onClearHistory={clearAllChats}
        chatSessions={chatSessions}
        activeSessionId={activeSessionId}
        uploading={uploading}
        userId={userId}
        onLogout={handleLogout}
      />
      <main className="main-panel">
        <ChatWindow
          messages={messages}
          loading={loading}
          userId={userId}
          uploadedFiles={uploadedFiles}
        />
        <InputBar onSend={sendMessage} loading={loading} hasFiles={uploadedFiles.length > 0} />
      </main>
    </div>
  )
}
