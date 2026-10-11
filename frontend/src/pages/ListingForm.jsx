import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ImageUploader from '../components/ImageUploader'
import Spinner from '../components/Spinner'

const CATEGORIES = ['trending', 'rooms', 'mansion', 'castles', 'pools', 'beaches', 'mountains', 'farmhouses']
const EMPTY = { title: '', description: '', cost: '', place: '', country: 'India', category: 'trending', maxGuests: 4 }
const MAX_PHOTOS = 10

export default function ListingForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [images, setImages] = useState([]) // [{ url, filename }] in display order
  const [primary, setPrimary] = useState(0) // index into `images` of the cover photo
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editing) return
    api
      .get(`/listings/${id}`)
      .then((l) => {
        if (l.owner?._id !== user.id) {
          toast.error('You can only edit your own listings')
          return navigate(`/listings/${id}`, { replace: true })
        }
        setForm({ ...EMPTY, title: l.title, description: l.description || '', cost: l.cost, place: l.place, country: l.country, category: l.category, maxGuests: l.maxGuests })
        setImages(l.images.map((i) => ({ url: i.url, filename: i.filename }))) // the API lists the cover photo first
        setPrimary(0)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!images.length) return setError('Add at least one photo')
    setBusy(true)
    try {
      const body = { ...form, cost: Number(form.cost), maxGuests: Number(form.maxGuests), images, primary }
      const saved = editing ? await api.put(`/listings/${id}`, body) : await api.post('/listings', body)
      toast.success(editing ? 'Listing updated' : 'Your stay is live!')
      navigate(`/listings/${saved._id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="container narrow">
      <h1>{editing ? 'Edit your listing' : 'Host a new stay'}</h1>
      <form className="panel form" onSubmit={submit}>
        <label>
          Title
          <input value={form.title} onChange={set('title')} required maxLength={80} placeholder="Sunny beach hut in Goa" />
        </label>
        <label>
          Description
          <textarea value={form.description} onChange={set('description')} rows={5} maxLength={3000} placeholder="What makes your place special?" />
        </label>

        <div className="field">
          <span>Photos</span>
          <p className="muted small">
            Add up to {MAX_PHOTOS}. {images.length > 1 ? 'Pick the cover photo guests see first with “Make cover”.' : 'With one photo, it is the cover photo automatically.'}
          </p>
          <ImageUploader images={images} onChange={setImages} primary={primary} onPrimary={setPrimary} max={MAX_PHOTOS} allowUrl />
        </div>

        <div className="form-grid">
          <label>
            Price per night (₹)
            <input type="number" min="1" value={form.cost} onChange={set('cost')} required />
          </label>
          <label>
            Max guests
            <input type="number" min="1" max="20" value={form.maxGuests} onChange={set('maxGuests')} required />
          </label>
          <label>
            Place / city
            <input value={form.place} onChange={set('place')} required placeholder="Goa" />
          </label>
          <label>
            Country
            <input value={form.country} onChange={set('country')} required />
          </label>
          <label>
            Category
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="row gap end">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy && <Loader2 className="spin" size={18} />}
            {editing ? 'Save changes' : 'Publish listing'}
          </button>
        </div>
      </form>
    </div>
  )
}
