import React, { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import './auth.css'

const Mark = () => (
  <span className="rx-auth-mark" aria-hidden="true">
    <svg viewBox="0 0 16 16">
      <rect x="1" y="1" width="6" height="6" rx="1.4" />
      <rect x="9" y="1" width="6" height="6" rx="1.4" opacity="0.55" />
      <rect x="1" y="9" width="6" height="6" rx="1.4" opacity="0.55" />
      <rect x="9" y="9" width="6" height="6" rx="1.4" />
    </svg>
  </span>
)

interface AuthShellProps {
  headline: string
  message: string
  children: React.ReactNode
}

export const AuthShell: React.FC<AuthShellProps> = ({ headline, message, children }) => {
  return (
    <div className="rx-auth">
      <aside className="rx-auth-visual">
        <img src="/landing/auth-workspace.jpg" alt="" />
        <div className="rx-auth-copy">
          <Link to="/" className="rx-auth-brand">
            <Mark />
            ResolveX
          </Link>
          <div>
            <h2>{headline}</h2>
            <p>{message}</p>
          </div>
        </div>
      </aside>
      <main className="rx-auth-panel">{children}</main>
    </div>
  )
}

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  placeholder: string
  autoComplete: string
  onChange: (value: string) => void
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  placeholder,
  autoComplete,
  onChange,
}) => {
  const [visible, setVisible] = useState(false)

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className="rx-field-control">
        <Lock className="rx-field-icon" size={16} aria-hidden="true" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="form-input"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          className="rx-field-toggle"
          type="button"
          aria-label={visible ? 'Hide characters' : 'Show characters'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
