import { useState } from 'react'
import { API_HEADERS, apiUrl } from './api.js'

const AUTH_MODES = [
  { id: 'login', label: 'Login' },
  { id: 'signup', label: 'Signup' },
  { id: 'forgot', label: 'Forgot' },
  { id: 'reset', label: 'Reset' },
]

const MODE_CONTENT = {
  signup: {
    eyebrow: 'Create access',
    title: 'Start your secure workspace',
    subtitle: 'Create your account with an email or user ID and 6-digit passcode.',
    button: 'Create account',
  },
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in to AI Workspace',
    subtitle: 'Continue your conversations, tools, diagrams, and saved history.',
    button: 'Sign in',
  },
  forgot: {
    eyebrow: 'Account lookup',
    title: 'Find your account',
    subtitle: 'Enter your email or user ID and we will prepare your passcode reset flow.',
    button: 'Find account',
  },
  reset: {
    eyebrow: 'Passcode reset',
    title: 'Set a new passcode',
    subtitle: 'Choose a fresh 6-digit passcode for your chatbot workspace.',
    button: 'Reset passcode',
  },
}

function normalizeIdentifier(value) {
  const identifier = value.trim()
  if (identifier.includes('@')) return identifier.toLowerCase()
  return identifier.toUpperCase()
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [userId, setUserId] = useState('')
  const [passcode, setPasscode] = useState('')
  const [newPasscode, setNewPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const normalizedIdentifier = normalizeIdentifier(userId)
  const isSignup = mode === 'signup'
  const isLogin = mode === 'login'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const modeContent = MODE_CONTENT[mode]

  const resetMessages = () => {
    setError('')
    setNotice('')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setPasscode('')
    setNewPasscode('')
    resetMessages()
  }

  const validatePasscode = (value, label = 'Passcode') => {
    if (!/^\d{6}$/.test(value.trim())) {
      setError(`${label} must be 6 digits`)
      return false
    }
    return true
  }

  const validateIdentifier = () => {
    if (!normalizedIdentifier) {
      setError('Please enter your email or user ID')
      return false
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier)
    const isUserId = /^[a-zA-Z0-9_-]{3,40}$/.test(userId.trim())

    if (!isEmail && !isUserId) {
      setError('Please enter a valid email or user ID')
      return false
    }

    return true
  }

  const handleSignup = async () => {
    if (!validateIdentifier()) return

    if (!passcode.trim()) {
      setError('Please enter your passcode')
      return
    }

    if (!validatePasscode(passcode)) return

    setLoading(true)
    resetMessages()

    try {
      const res = await fetch(apiUrl('/signup'), {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: normalizedIdentifier,
          passcode: passcode.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Signup failed')
        return
      }

      setMode('login')
      setNotice('Signup successful. Login to open the chatbot.')
    } catch {
      setError('Cannot connect to server. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!validateIdentifier()) return

    if (!passcode.trim()) {
      setError('Please enter your passcode')
      return
    }

    setLoading(true)
    resetMessages()

    try {
      const res = await fetch(apiUrl('/login'), {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: normalizedIdentifier,
          passcode: passcode.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Login failed')
        return
      }

      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('user_id', normalizedIdentifier)
      onLogin(data.token, normalizedIdentifier)
    } catch {
      setError('Cannot connect to server. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!validateIdentifier()) return

    setLoading(true)
    resetMessages()

    try {
      const res = await fetch(apiUrl('/forgot-password'), {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: normalizedIdentifier }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'User not found')
        return
      }

      setMode('reset')
      setNotice('User found. Enter a new 6-digit passcode.')
    } catch {
      setError('Cannot connect to server. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!validateIdentifier()) return

    if (!newPasscode.trim()) {
      setError('Please enter your new passcode')
      return
    }

    if (!validatePasscode(newPasscode, 'New passcode')) return

    setLoading(true)
    resetMessages()

    try {
      const res = await fetch(apiUrl('/reset-password'), {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: normalizedIdentifier,
          new_passcode: newPasscode.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Password reset failed')
        return
      }

      setPasscode(newPasscode.trim())
      setNewPasscode('')
      setMode('login')
      setNotice('Passcode reset successful. Login with your new passcode.')
    } catch {
      setError('Cannot connect to server. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    if (mode === 'signup') handleSignup()
    else if (mode === 'login') handleLogin()
    else if (mode === 'forgot') handleForgotPassword()
    else handleResetPassword()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') handleSubmit()
  }

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="AI Workspace overview">
        <div className="auth-brand">
          <div className="auth-brand-mark">AI</div>
          <div>
            <div className="auth-brand-name">AI Workspace</div>
            <div className="auth-brand-subtitle">Intelligent assistant</div>
          </div>
        </div>

        <div className="auth-hero-copy">
          <p className="auth-kicker">AI chatbot platform</p>
          <h1>Your workspace for intelligent conversations.</h1>
          <p>
            A flexible assistant experience built to support knowledge workflows,
            automation, visual outputs, and new capabilities as the platform grows.
          </p>
        </div>

        <div className="auth-motion-strip" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="auth-panel" aria-label="Authentication form">
        <div className="auth-panel-header">
          <p>{modeContent.eyebrow}</p>
          <h2>{modeContent.title}</h2>
          <span>{modeContent.subtitle}</span>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication options">
          {AUTH_MODES.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? 'is-active' : ''}
              onClick={() => switchMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="auth-form">
          <label className="auth-field">
            <span>Email or User ID</span>
            <input
              type="text"
              value={userId}
              onChange={event => setUserId(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="name@company.com or EMB001"
              autoComplete="username"
            />
          </label>

          {(isSignup || isLogin) && (
            <label className="auth-field">
              <span>Passcode</span>
              <input
                type="password"
                value={passcode}
                onChange={event => setPasscode(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="6-digit passcode"
                maxLength={6}
                inputMode="numeric"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </label>
          )}

          {isReset && (
            <label className="auth-field">
              <span>New passcode</span>
              <input
                type="password"
                value={newPasscode}
                onChange={event => setNewPasscode(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="New 6-digit passcode"
                maxLength={6}
                inputMode="numeric"
                autoComplete="new-password"
              />
            </label>
          )}

          {error && <div className="auth-alert error">{error}</div>}
          {notice && <div className="auth-alert success">{notice}</div>}

          <button
            className="auth-submit"
            type="button"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Please wait...' : modeContent.button}
          </button>
        </div>

        <div className="auth-switcher">
          {isSignup && <>Already have access? <InlineButton onClick={() => switchMode('login')}>Login</InlineButton></>}
          {isLogin && <>Forgot your passcode? <InlineButton onClick={() => switchMode('forgot')}>Reset it</InlineButton></>}
          {isForgot && <>Remembered it? <InlineButton onClick={() => switchMode('login')}>Login</InlineButton></>}
          {isReset && <>Ready now? <InlineButton onClick={() => switchMode('login')}>Login</InlineButton></>}
        </div>

      </section>
    </main>
  )
}

function InlineButton({ children, onClick }) {
  return (
    <button className="auth-inline-button" type="button" onClick={onClick}>
      {children}
    </button>
  )
}
