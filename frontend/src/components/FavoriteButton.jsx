import { Heart } from 'lucide-react'
import { useFavorites } from '../context/FavoritesContext'

/** Heart toggle. `variant="card"` floats over a listing photo; `variant="inline"` is a text button (Save / Saved). */
export default function FavoriteButton({ id, variant = 'card' }) {
  const fav = useFavorites()
  const saved = fav.has(id)
  const click = (e) => {
    e.preventDefault()
    e.stopPropagation()
    fav.toggle(id)
  }
  if (variant === 'inline') {
    return (
      <button className={`btn btn-ghost btn-sm save-inline ${saved ? 'on' : ''}`} onClick={click} aria-pressed={saved}>
        <Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}
      </button>
    )
  }
  return (
    <button className={`heart ${saved ? 'on' : ''}`} onClick={click} aria-pressed={saved} aria-label={saved ? 'Remove from saved stays' : 'Save this stay'}>
      <Heart size={20} fill={saved ? 'currentColor' : 'rgba(0,0,0,.35)'} strokeWidth={2} />
    </button>
  )
}
