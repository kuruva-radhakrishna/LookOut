import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!tokenStore.get())

  const logout = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) return
    api
      .get('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => {}) // a 401 clears the token via the handler; network errors keep the session
      .finally(() => setReady(true))
  }, [logout])

  const authenticate = useCallback(async (path, body) => {
    const r = await api.post(path, body)
    tokenStore.set(r.token)
    setUser(r.user)
    return r.user
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      logout,
      login: (b) => authenticate('/auth/login', b),
      signup: (b) => authenticate('/auth/signup', b),
    }),
    [user, ready, logout, authenticate],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
