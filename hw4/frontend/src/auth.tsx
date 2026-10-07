// Client-side auth state: who is logged in, their signed session token, and
// signup/login/logout calls.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type User = {
  id: number
  first_name: string | null
  last_name: string | null
  name: string
  email: string
}

type Session = {
  user: User
  token: string // signed by the backend; sent as `Authorization: Bearer <token>`
}

type AuthContextValue = {
  user: User | null
  token: string | null
  signup: (data: SignupData) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

type SignupData = {
  first_name: string
  last_name: string
  email: string
  password: string
}

const STORAGE_KEY = 'campus-customs-session'
const OLD_STORAGE_KEY = 'campus-customs-user' // Problem 4 format, had no token
const AuthContext = createContext<AuthContextValue | null>(null)

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const data = await res.json()
      if (data?.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch {
      // keep default detail
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

function readStoredSession(): Session | null {
  localStorage.removeItem(OLD_STORAGE_KEY)
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return stored?.user && stored?.token ? stored : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession)
  const [storedToken] = useState(() => session?.token)

  // On first load, check the stored token is still valid (tokens expire).
  useEffect(() => {
    if (!storedToken) return
    fetch('/api/me', { headers: { Authorization: `Bearer ${storedToken}` } }).then((res) => {
      if (res.status === 401) {
        setSession(null)
        localStorage.removeItem(STORAGE_KEY)
      }
    })
  }, [storedToken])

  function remember(s: Session) {
    setSession(s)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    token: session?.token ?? null,
    async signup(data) {
      remember(await postJson<Session>('/api/signup', data))
    },
    async login(email, password) {
      remember(await postJson<Session>('/api/login', { email, password }))
    },
    logout() {
      setSession(null)
      localStorage.removeItem(STORAGE_KEY)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
