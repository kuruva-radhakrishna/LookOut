import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { api } from '../lib/api'
import { useFavorites } from '../context/FavoritesContext'
import ListingCard from '../components/ListingCard'
import Spinner from '../components/Spinner'

export default function Saved() {
  const fav = useFavorites()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/favorites')
      .then(setItems)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="container empty">{error}</div>
  if (!items) return <Spinner />

  // a stay you un-save here disappears from the page right away
  const shown = items.filter((l) => fav.has(l._id))

  return (
    <div className="page-wide saved">
      <div className="page-title">
        <div>
          <h1>Saved stays</h1>
          <p className="muted">{shown.length ? `${shown.length} stay${shown.length > 1 ? 's' : ''} you've saved` : 'Stays you save with the heart show up here.'}</p>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="empty">
          <Heart size={40} />
          <h3>Nothing saved yet</h3>
          <p className="muted">Tap the heart on any stay to keep it for later.</p>
          <Link className="btn btn-dark" to="/">
            Explore stays
          </Link>
        </div>
      ) : (
        <div className="grid">
          {shown.map((l) => (
            <ListingCard key={l._id} listing={l} withTax={false} />
          ))}
        </div>
      )}
    </div>
  )
}
