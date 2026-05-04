import { useState, useCallback } from 'react'
import axios from 'axios'
import Sidebar from './components/Sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import InputBar from './components/InputBar.jsx'
import './App.css'

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Welcome to the EMB RAG Chatbot!\n\nUpload a **.txt** file using the sidebar, then ask me anything about it.',
      sources: [],
      chunksUsed: 0,
    },
  ])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || loading) return

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userText, sources: [], chunksUsed: 0 },
    ])
    setLoading(true)

    try {
      const res = await axios.post('/api/chat', {
        message: userText,
        history: history,
        top_k: 4,
      })

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.answer,
          sources: res.data.sources,
          chunksUsed: res.data.chunks_used,
        },
      ])

      setHistory(prev => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: res.data.answer },
      ])
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Unknown error'
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error: ${detail}`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [history, loading])

  const handleFileUpload = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post('/api/ingest/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setUploadedFiles(prev => [...new Set([...prev, file.name])])
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `✅ **${file.name}** uploaded!\n${res.data.message}\n\nNow ask me anything about it.`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Upload failed: ${err.response?.data?.detail || err.message}`,
          sources: [],
          chunksUsed: 0,
        },
      ])
    }
  }, [])

  const clearChat = useCallback(() => {
    setMessages([{
      role: 'assistant',
      content: 'Chat cleared! Upload a file and ask me anything.',
      sources: [],
      chunksUsed: 0,
    }])
    setHistory([])
  }, [])

  return (
    <div className="app-container">
      <Sidebar
        uploadedFiles={uploadedFiles}
        onFileUpload={handleFileUpload}
        onClearChat={clearChat}
      />
      <div className="main-panel">
        <ChatWindow messages={messages} loading={loading} />
        <InputBar onSend={sendMessage} loading={loading} />
      </div>
    </div>
  )
}