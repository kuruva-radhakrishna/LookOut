import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, Heart, LogIn, LogOut, Luggage, Menu, Plus, UserPlus } from 'lucide-react'
import SearchBar from './SearchBar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = (e) => !wrap.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const go = (to) => () => {
    setOpen(false)
    navigate(to)
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="LookOut home">
          <Compass size={30} strokeWidth={2.2} />
          <span>LookOut</span>
        </Link>

        <div className="nav-search">
          <SearchBar />
        </div>

        <div className="nav-right" ref={wrap}>
          {user && (
            <Link to="/bookings" className="host-link">
              My bookings
            </Link>
          )}
          <Link to="/listings/new" className="host-link">
            Host a stay
          </Link>
          <button className="user-pill" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
            <Menu size={16} />
            <span className="user-avatar">{user ? user.username[0].toUpperCase() : <UserIcon />}</span>
          </button>

          {open && (
            <div className="menu" role="menu">
              {user ? (
                <>
                  <p className="menu-who">Signed in as <strong>@{user.username}</strong></p>
                  <button role="menuitem" onClick={go('/bookings')}>
                    <Luggage size={16} /> My bookings
                  </button>
                  <button role="menuitem" onClick={go('/saved')}>
                    <Heart size={16} /> Saved stays
                  </button>
                  <button role="menuitem" onClick={go('/listings/new')}>
                    <Plus size={16} /> Host a stay
                  </button>
                  <hr />
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false)
                      logout()
                      toast.success('Logged out')
                      navigate('/')
                    }}
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </>
              ) : (
                <>
                  <button role="menuitem" className="strong" onClick={go('/login')}>
                    <LogIn size={16} /> Log in
                  </button>
                  <button role="menuitem" onClick={go('/signup')}>
                    <UserPlus size={16} /> Sign up
                  </button>
                  <hr />
                  <button role="menuitem" onClick={go('/listings/new')}>
                    <Plus size={16} /> Host a stay
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
  </svg>
)
