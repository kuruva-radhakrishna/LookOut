import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ImagePlus, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Spinner from '../components/Spinner'

const CATEGORIES = ['trending', 'rooms', 'mansion', 'castles', 'pools', 'beaches', 'mountains', 'farmhouses']
const EMPTY = { title: '', description: '', cost: '', place: '', country: 'India', category: 'trending', maxGuests: 4, imageUrl: '' }

export default function ListingForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [uploads, setUploads] = useState(true)
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/health').then((h) => setUploads(h.uploads)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!editing) return
    api
      .get(`/listings/${id}`)
      .then((l) => {
        if (l.owner?._id !== user.id) {
          toast.error("You can only edit your own listings")
          return navigate(`/listings/${id}`, { replace: true })
        }
        setForm({ ...EMPTY, ...l, imageUrl: '' })
        setPreview(l.img?.url || '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return setError('Image must be under 5 MB')
    setError('')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!editing && !file && !form.imageUrl) return setError('Please add a photo')
    setBusy(true)
    try {
      const fd = new FormData()
      ;['title', 'description', 'cost', 'place', 'country', 'category', 'maxGuests'].forEach((k) => fd.append(k, form[k]))
      if (file) fd.append('image', file)
      else if (form.imageUrl) fd.append('imageUrl', form.imageUrl)
      const saved = editing ? await api.put(`/listings/${id}`, fd) : await api.post('/listings', fd)
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
          <span>Photo</span>
          <div className="upload">
            {preview ? <img src={preview} alt="Preview" /> : <ImagePlus size={32} />}
            <div className="upload-controls">
              {uploads && <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} aria-label="Upload photo" />}
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => {
                  setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  setFile(null)
                  setPreview(e.target.value)
                }}
                placeholder={uploads ? 'or paste an image URL' : 'Paste an image URL (file upload is not configured)'}
              />
            </div>
          </div>
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
