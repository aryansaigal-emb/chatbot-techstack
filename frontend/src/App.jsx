import { useState, useCallback, useEffect } from 'react'
import Login from './login.jsx'
import Sidebar from './components/sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import InputBar from './components/InputBar.jsx'
import { API_HEADERS, apiUrl } from './api.js'
import './App.css'

const CHAT_MESSAGES_KEY = 'chat_messages'
const CHAT_HISTORY_KEY = 'chat_history'
const MAX_HISTORY_ITEMS = 20

function getSavedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export default function App() {
  const [token, setToken] = useState(null)
  const [userId, setUserId] = useState('')
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  // Check if already logged in on page load
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
    const savedUserId = localStorage.getItem('user_id')
    const savedMessages = getSavedArray(CHAT_MESSAGES_KEY)
    const savedHistory = getSavedArray(CHAT_HISTORY_KEY)
    if (savedToken && savedUserId) {
      setToken(savedToken)
      setUserId(savedUserId)
      setMessages(savedMessages.length > 0 ? savedMessages : [{
        role: 'assistant',
        content: `👋 Welcome back **${savedUserId}**!\n\nUpload a PDF, TXT, or MD file and ask me anything about it.`,
        sources: [],
        chunksUsed: 0,
      }])
      setHistory(savedHistory.slice(-MAX_HISTORY_ITEMS))
    }
  }, [])

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

  // Called when login succeeds
  const handleLogin = (newToken, newUserId) => {
    setToken(newToken)
    setUserId(newUserId)
    setMessages([{
      role: 'assistant',
      content: `👋 Welcome **${newUserId}**!\n\nUpload a PDF, TXT, or MD file using the sidebar and ask me anything about it.`,
      sources: [],
      chunksUsed: 0,
    }])
    setHistory([])
    localStorage.removeItem(CHAT_MESSAGES_KEY)
    localStorage.removeItem(CHAT_HISTORY_KEY)
  }

  // Logout
  const handleLogout = useCallback(async () => {
    try {
      await fetch(apiUrl('/logout'), {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
      })
    } catch (e) {}
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_id')
    localStorage.removeItem(CHAT_MESSAGES_KEY)
    localStorage.removeItem(CHAT_HISTORY_KEY)
    setToken(null)
    setUserId('')
    setMessages([])
    setHistory([])
    setUploadedFiles([])
  }, [token])

  // Send message
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
          Authorization: `Bearer ${token}`,   // send token with every request
        },
        body: JSON.stringify({
          message: userText,
          history: history,
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
          sources: data.sources,
          chunksUsed: data.chunks_used,
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
          content: `⚠️ Error: ${err.message}`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [history, loading, token, handleLogout])

  // Upload file
  const handleFileUpload = useCallback(async (file) => {
    setUploading(true)
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `⏳ Uploading **${file.name}**...`,
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
          Authorization: `Bearer ${token}`,   // send token
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
          content: `✅ **${file.name}** uploaded!\n${data.message}\n\nNow ask me anything about it.`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: `❌ Upload failed: ${err.message}`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } finally {
      setUploading(false)
    }
  }, [token, handleLogout])

  const clearChat = useCallback(() => {
    const clearedMessages = [{
      role: 'assistant',
      content: 'Chat cleared! Ask me anything.',
      sources: [],
      chunksUsed: 0,
    }]
    setMessages(clearedMessages)
    setHistory([])
    localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(clearedMessages))
    localStorage.removeItem(CHAT_HISTORY_KEY)
  }, [])

  // Show login page if not logged in
  if (!token) {
    return <Login onLogin={handleLogin} />
  }

  // Show chatbot if logged in
  return (
    <div className="app-container">
      <Sidebar
        uploadedFiles={uploadedFiles}
        onFileUpload={handleFileUpload}
        onClearChat={clearChat}
        uploading={uploading}
        userId={userId}
        onLogout={handleLogout}
      />
      <div className="main-panel">
        <ChatWindow messages={messages} loading={loading} />
        <InputBar onSend={sendMessage} loading={loading} />
      </div>
    </div>
  )
}
