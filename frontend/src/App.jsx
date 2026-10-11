import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import ListingDetail from './pages/ListingDetail'
import ListingForm from './pages/ListingForm'
import Auth from './pages/Auth'
import Checkout from './pages/Checkout'
import Trips from './pages/Trips'
import Saved from './pages/Saved'
import { FavoritesProvider } from './context/FavoritesContext'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const NotFound = () => (
  <div className="container empty">
    <h1>404</h1>
    <p className="muted">We couldn't find that page.</p>
    <Link className="btn btn-dark" to="/">
      Back to explore
    </Link>
  </div>
)

const guard = (el) => <ProtectedRoute>{el}</ProtectedRoute>

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <FavoritesProvider>
          <ScrollToTop />
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/listings/new" element={guard(<ListingForm />)} />
              <Route path="/listings/:id" element={<ListingDetail />} />
              <Route path="/listings/:id/edit" element={guard(<ListingForm />)} />
              <Route path="/checkout/:id" element={guard(<Checkout />)} />
              <Route path="/saved" element={guard(<Saved />)} />
              <Route path="/bookings" element={guard(<Trips />)} />
              <Route path="/trips" element={<Navigate to="/bookings" replace />} />
              <Route path="/login" element={<Auth mode="login" />} />
              <Route path="/signup" element={<Auth mode="signup" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="footer">
            <div className="container">© {new Date().getFullYear()} LookOut · Find your next stay</div>
          </footer>
          </FavoritesProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
