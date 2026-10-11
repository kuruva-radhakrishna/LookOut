import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const FavoritesContext = createContext(null)

/** The signed-in guest's saved stays, loaded once as a set of ids so any card can show a filled heart. */
export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [ids, setIds] = useState(() => new Set())

  useEffect(() => {
    if (!user) {
      setIds(new Set())
      return
    }
    let live = true
    api
      .get('/favorites/ids')
      .then((list) => live && setIds(new Set(list)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [user])

  const toggle = useCallback(
    async (id) => {
      if (!user) {
        toast.error('Log in to save stays')
        navigate('/login', { state: { from: location.pathname + location.search } })
        return
      }
      const had = ids.has(id)
      const flip = (on) =>
        setIds((s) => {
          const next = new Set(s)
          if (on) next.add(id)
          else next.delete(id)
          return next
        })
      flip(!had) // optimistic: the heart responds instantly
      try {
        if (had) await api.del(`/favorites/${id}`)
        else await api.put(`/favorites/${id}`)
        if (!had) toast.success('Saved to your list')
      } catch (err) {
        flip(had)
        toast.error(err.message)
      }
    },
    [user, ids, toast, navigate, location],
  )

  const value = useMemo(() => ({ has: (id) => ids.has(id), toggle, count: ids.size }), [ids, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFavorites = () => useContext(FavoritesContext)
