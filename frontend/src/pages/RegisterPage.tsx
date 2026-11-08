import React, { useState } from 'react'
import { ArrowRight, Mail, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell, PasswordField } from '../components/auth/AuthShell'
import { ErrorAlert } from '../components/ErrorAlert'
import { useAuth } from '../context/AuthContext'

export const RegisterPage: React.FC = () => {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters long.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)
      await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      navigate('/home', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      headline="A better way to manage service requests."
      message="Create an account, join an organization with an invite code, and raise tickets your team can assign and resolve."
    >
      <div className="rx-auth-card">
        <h1>Create your account</h1>
        <p>Join an organization and start raising tickets.</p>

        <ErrorAlert message={error} onDismiss={() => setError(null)} />

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">
              Full Name
            </label>
            <div className="rx-field-control">
              <User className="rx-field-icon" size={16} aria-hidden="true" />
              <input
                id="fullName"
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>
          </div>

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
                placeholder="jane@organization.com"
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
            placeholder="At least 8 characters"
            autoComplete="new-password"
            onChange={setPassword}
          />

          <PasswordField
            id="confirmPassword"
            label="Confirm Password"
            value={confirmPassword}
            placeholder="Re-type your password"
            autoComplete="new-password"
            onChange={setConfirmPassword}
          />

          <button className="rx-auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
            {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>

        <p className="rx-auth-links">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
