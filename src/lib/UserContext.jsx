import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { API_BASE } from "@/lib/auth"

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // On mount: if a token exists, validate it and hydrate user from /api/auth/me
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { setAuthLoading(false); return }

    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) { localStorage.removeItem("token"); return null }
        return r.json()
      })
      .then(data => { if (data) setUser(data) })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  // Called after a successful login / register
  const login = useCallback((tokenData) => {
    localStorage.setItem("token", tokenData.access_token)
    // Optimistically set what we already have; full profile is in DB
    setUser({ full_name: tokenData.full_name, role: tokenData.role })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setUser(null)
  }, [])

  return (
    <UserContext.Provider value={{ user, authLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
