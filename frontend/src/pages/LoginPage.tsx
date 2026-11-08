import React, { useState } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell, PasswordField } from '../components/auth/AuthShell'
import { ErrorAlert } from '../components/ErrorAlert'
import { useAuth } from '../context/AuthContext'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please provide both email and password.')
      return
    }

    try {
      setIsSubmitting(true)
      const loggedInUser = await login({ email: email.trim(), password })
      if (loggedInUser.is_platform_admin) {
        navigate('/platform-admin/dashboard', { replace: true })
      } else {
        const from = (location.state as { from?: { pathname?: string } })?.from?.pathname
        const targetPath = from && !from.startsWith('/platform-admin') ? from : '/home'
        navigate(targetPath, { replace: true })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      headline="Your work deserves a clearer way forward."
      message="Access your organization workspace, raise service requests and stay informed as issues move towards resolution."
    >
      <div className="rx-auth-card">
        <h1>Welcome back</h1>
        <p>Sign in to your ResolveX workspace.</p>

        <ErrorAlert message={error} onDismiss={() => setError(null)} />

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Work Email
            </label>
            <div className="rx-field-control">
              <Mail className="rx-field-icon" size={16} aria-hidden="true" />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="name@organization.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <PasswordField
            id="password"
            label="Password"
            value={password}
            placeholder="Enter your password"
            autoComplete="current-password"
            onChange={setPassword}
          />

          <button className="rx-auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
            {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>

        <p className="rx-auth-links">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <div className="rx-auth-admin">
          <Link to="/platform-admin/login">Platform administrator sign in</Link>
        </div>
      </div>
    </AuthShell>
  )
}
