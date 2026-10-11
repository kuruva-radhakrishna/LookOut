import { useRef, useState } from 'react'
import { ImagePlus, Link2, Loader2, Star, X } from 'lucide-react'
import { isHttpUrl, uploadImages } from '../lib/images'
import { useToast } from '../context/ToastContext'

/**
 * Multi-photo picker: drop or choose files (uploaded to the API as soon as they're picked), optionally add by URL,
 * remove photos, and, when `onPrimary` is given, choose which one is the cover photo.
 * `images` is [{ url, filename? }]; this component never mutates it, it calls `onChange` with a new array.
 */
export default function ImageUploader({ images, onChange, primary = 0, onPrimary, max = 10, allowUrl = false, label = 'Add photos' }) {
  const toast = useToast()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [url, setUrl] = useState('')
  const room = max - images.length

  async function addFiles(fileList) {
    const files = [...fileList]
    if (!files.length) return
    if (files.length > room) toast.error(`You can add ${room} more photo${room === 1 ? '' : 's'} (max ${max}). Extra files were skipped.`)
    const take = files.slice(0, Math.max(0, room))
    if (!take.length) return
    setBusy(true)
    try {
      const stored = await uploadImages(take)
      onChange([...images, ...stored])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  function addUrl() {
    const u = url.trim()
    if (!isHttpUrl(u)) return toast.error('Enter a valid image link starting with http:// or https://')
    if (images.some((i) => i.url === u)) return toast.error('That photo is already added')
    if (room <= 0) return toast.error(`At most ${max} photos`)
    onChange([...images, { url: u }])
    setUrl('')
  }

  function remove(i) {
    const next = images.filter((_, idx) => idx !== i)
    onChange(next)
    if (onPrimary) onPrimary(i === primary ? 0 : i < primary ? primary - 1 : primary) // keep pointing at the same photo
  }

  return (
    <div className="uploader">
      {images.length > 0 && (
        <ul className="up-grid">
          {images.map((img, i) => (
            <li key={img.url} className={`up-thumb ${onPrimary && i === primary ? 'is-cover' : ''}`}>
              <img src={img.url} alt={`Photo ${i + 1}`} loading="lazy" />
              {onPrimary && i === primary && <span className="up-badge">Cover photo</span>}
              <div className="up-actions">
                {onPrimary && i !== primary && (
                  <button type="button" onClick={() => onPrimary(i)} aria-label={`Make photo ${i + 1} the cover photo`} title="Make cover photo">
                    <Star size={14} /> Make cover
                  </button>
                )}
                <button type="button" className="up-x" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`} title="Remove">
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <div
          className={`up-drop ${over ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            addFiles(e.dataTransfer.files)
          }}
        >
          <input ref={input} id={`up-${label}`} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : <ImagePlus size={16} />}
            {busy ? 'Uploading…' : label}
          </button>
          <span className="muted small">or drop images here · {images.length}/{max}</span>
        </div>
      )}

      {allowUrl && room > 0 && (
        <div className="up-url">
          <Link2 size={16} />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addUrl()
              }
            }}
            placeholder="or paste an image link"
            aria-label="Image link"
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={addUrl} disabled={!url.trim()}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}
