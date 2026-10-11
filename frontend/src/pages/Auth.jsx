import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Compass, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Auth({ mode }) {
  const isSignup = mode === 'signup'
  const { user, login, signup } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (isSignup) await signup(form)
      else await login({ username: form.username, password: form.password })
      toast.success(isSignup ? 'Welcome to LookOut!' : 'Welcome back!')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="panel auth-card" onSubmit={submit}>
        <Compass size={32} className="accent" />
        <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isSignup ? 'Book stays and host your own.' : 'Log in to manage your bookings.'}</p>

        <label>
          {isSignup ? 'Username' : 'Username or email'}
          <input value={form.username} onChange={set('username')} required minLength={isSignup ? 3 : 1} maxLength={30} autoComplete="username" autoFocus />
        </label>
        {isSignup && (
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
          </label>
        )}
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={isSignup ? 8 : 1}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
          {isSignup && <small className="muted">At least 8 characters</small>}
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy && <Loader2 className="spin" size={18} />}
          {isSignup ? 'Sign up' : 'Log in'}
        </button>
        <p className="muted center">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <Link to={isSignup ? '/login' : '/signup'} state={location.state}>
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </form>
    </div>
  )
}
