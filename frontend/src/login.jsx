import { useState } from 'react'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('signup')
  const [userId, setUserId] = useState('')
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const normalizedUserId = userId.trim().toUpperCase()

  const resetMessages = () => {
    setError('')
    setNotice('')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    resetMessages()
  }

  const handleSignup = async () => {
    if (!normalizedUserId || !passcode.trim()) {
      setError('Please enter both User ID and Passcode')
      return
    }

    if (!/^\d{6}$/.test(passcode.trim())) {
      setError('Passcode must be 6 digits')
      return
    }

    setLoading(true)
    resetMessages()

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: normalizedUserId,
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
    } catch (err) {
      setError('Cannot connect to server. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!normalizedUserId || !passcode.trim()) {
      setError('Please enter both User ID and Passcode')
      return
    }

    setLoading(true)
    resetMessages()

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: normalizedUserId,
          passcode: passcode.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Login failed')
        return
      }

      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('user_id', normalizedUserId)
      onLogin(data.token, normalizedUserId)
    } catch (err) {
      setError('Cannot connect to server. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    if (mode === 'signup') {
      handleSignup()
    } else {
      handleLogin()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const isSignup = mode === 'signup'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '16px',
        padding: '36px',
        width: '100%',
        maxWidth: '420px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '28px',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: '#10a37f',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
          }}>
            AI
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '18px', color: '#ececec' }}>
              EMB Global
            </div>
            <div style={{ fontSize: '11px', color: '#777', letterSpacing: '2px' }}>
              RAG CHATBOT
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '24px',
          background: '#111',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #242424',
        }}>
          {['signup', 'login'].map(item => (
            <button
              key={item}
              type="button"
              onClick={() => switchMode(item)}
              style={{
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                background: mode === item ? '#10a37f' : 'transparent',
                color: mode === item ? '#fff' : '#888',
                fontWeight: '700',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#ececec' }}>
            {isSignup ? 'Create Your Account' : 'Welcome Back'}
          </div>
          <div style={{ fontSize: '13px', color: '#777', marginTop: '6px' }}>
            {isSignup ? 'Signup first, then login to enter the chatbot' : 'Login to open the chatbot'}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: '#888',
            marginBottom: '6px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            User ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. EMB004"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              background: '#111',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#ececec',
              fontSize: '14px',
              outline: 'none',
              letterSpacing: '2px',
            }}
            onFocus={e => e.target.style.borderColor = '#10a37f'}
            onBlur={e => e.target.style.borderColor = '#2a2a2a'}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            color: '#888',
            marginBottom: '6px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            Passcode
          </label>
          <input
            type="password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter 6-digit passcode"
            maxLength={6}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              background: '#111',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#ececec',
              fontSize: '14px',
              outline: 'none',
              letterSpacing: '4px',
            }}
            onFocus={e => e.target.style.borderColor = '#10a37f'}
            onBlur={e => e.target.style.borderColor = '#2a2a2a'}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,80,80,0.1)',
            border: '1px solid rgba(255,80,80,0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#ff6b6b',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{
            background: 'rgba(16,163,127,0.1)',
            border: '1px solid rgba(16,163,127,0.35)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#40d6ae',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {notice}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? '#0a6e54' : '#10a37f',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '15px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
        </button>

        <div style={{
          marginTop: '18px',
          textAlign: 'center',
          color: '#777',
          fontSize: '13px',
        }}>
          {isSignup ? 'Already signed up?' : 'Need an account?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? 'login' : 'signup')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#10a37f',
              cursor: 'pointer',
              fontWeight: '700',
              padding: 0,
            }}
          >
            {isSignup ? 'Login' : 'Signup'}
          </button>
        </div>

        {!isSignup && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: '#111',
            borderRadius: '8px',
            border: '1px solid #1e1e1e',
          }}>
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', letterSpacing: '1px' }}>
              TEST CREDENTIALS
            </div>
            {[
              { id: 'EMB001', pass: '123456' },
              { id: 'EMB002', pass: '654321' },
              { id: 'EMB003', pass: '111222' },
            ].map(cred => (
              <div
                key={cred.id}
                onClick={() => { setUserId(cred.id); setPasscode(cred.pass); resetMessages() }}
                style={{
                  fontSize: '12px',
                  color: '#666',
                  padding: '3px 0',
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#10a37f'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}
              >
                {cred.id} / {cred.pass}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
