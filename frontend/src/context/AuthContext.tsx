import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import type { LoginCredentials, RegisterData, User } from '../types/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  platformAdminLogin: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(api.getToken())
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshUser = async () => {
    const currentToken = api.getToken()
    if (!currentToken) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const userData = await api.auth.getMe()
      setUser(userData)
    } catch {
      api.clearToken()
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()

    const handleUnauthorized = () => {
      setUser(null)
      setToken(null)
    }

    const handleAuthChange = () => {
      setToken(api.getToken())
    }

    window.addEventListener('resolvex:unauthorized', handleUnauthorized)
    window.addEventListener('resolvex:auth-change', handleAuthChange)

    return () => {
      window.removeEventListener('resolvex:unauthorized', handleUnauthorized)
      window.removeEventListener('resolvex:auth-change', handleAuthChange)
    }
  }, [])

  const login = async (credentials: LoginCredentials) => {
    const tokenRes = await api.auth.login(credentials)
    api.setToken(tokenRes.access_token)
    setToken(tokenRes.access_token)
    const userData = await api.auth.getMe()
    setUser(userData)
  }

  const platformAdminLogin = async (credentials: LoginCredentials) => {
    const tokenRes = await api.auth.platformAdminLogin(credentials)
    api.setToken(tokenRes.access_token)
    setToken(tokenRes.access_token)
    const userData = await api.auth.getMe()
    setUser(userData)
  }

  const register = async (data: RegisterData) => {
    await api.auth.register(data)
    await login({ email: data.email, password: data.password })
  }

  const logout = () => {
    api.clearToken()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        platformAdminLogin,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
