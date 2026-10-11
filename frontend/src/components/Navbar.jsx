import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Compass, LogOut, Menu, Plus, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand" onClick={close}>
          <Compass size={26} strokeWidth={2.2} />
          <span>LookOut</span>
        </Link>

        <button className="icon-btn nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={`nav-links ${open ? 'open' : ''}`} onClick={close}>
          <NavLink to="/" end>
            Explore
          </NavLink>
          {user && <NavLink to="/trips">My trips</NavLink>}
          <NavLink to="/listings/new" className="nav-cta">
            <Plus size={16} /> Host a stay
          </NavLink>
          {user ? (
            <>
              <span className="nav-user">@{user.username}</span>
              <button
                className="btn btn-ghost"
                onClick={() => {
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
              <NavLink to="/login">Log in</NavLink>
              <Link className="btn btn-primary" to="/signup">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
