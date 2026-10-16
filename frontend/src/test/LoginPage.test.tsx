import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { LoginPage } from '../pages/LoginPage'
import { api } from '../services/api'

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders login form with work email and password inputs', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error banner when submitted with empty fields', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    )

    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitBtn)

    // Form has required attributes, but if triggered programmatically
    const form = submitBtn.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/please provide both email and password/i)).toBeInTheDocument()
    })
  })

  it('calls login API and sets auth on valid credentials', async () => {
    vi.spyOn(api.auth, 'login').mockResolvedValue({
      access_token: 'fake-jwt',
      token_type: 'bearer',
    })
    vi.spyOn(api.auth, 'getMe').mockResolvedValue({
      id: 'user-1',
      email: 'user@acme.edu',
      full_name: 'Jane Doe',
      is_active: true,
      created_at: '2026-10-16T00:00:00Z',
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    )

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@acme.edu' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Password123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(api.auth.login).toHaveBeenCalledWith({
        email: 'user@acme.edu',
        password: 'Password123!',
      })
    })
  })
})
