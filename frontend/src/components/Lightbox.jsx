import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/** Full-screen photo viewer: arrows, keyboard (← → Esc), a thumbnail strip and the photographer credit when we have one. */
export default function Lightbox({ images, start = 0, onClose }) {
  const ref = useRef(null)
  const [i, setI] = useState(start)
  const n = images.length
  const go = (d) => setI((x) => (x + d + n) % n)

  useEffect(() => {
    const dlg = ref.current
    if (dlg && !dlg.open) dlg.showModal()
  }, [])
  useEffect(() => {
    ref.current?.querySelector('.lb-thumb.on')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [i])

  const cur = images[i]
  return (
    <dialog
      ref={ref}
      className="lightbox"
      onCancel={onClose}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
    >
      <header className="lb-top">
        <button className="lb-btn" onClick={onClose} aria-label="Close photos">
          <X size={20} />
        </button>
        <span className="lb-count" aria-live="polite">
          {i + 1} / {n}
        </span>
        <span />
      </header>

      <div className="lb-stage">
        {n > 1 && (
          <button className="lb-btn lb-nav" onClick={() => go(-1)} aria-label="Previous photo">
            <ChevronLeft size={22} />
          </button>
        )}
        <img src={cur.url} alt={`Photo ${i + 1} of ${n}`} />
        {n > 1 && (
          <button className="lb-btn lb-nav" onClick={() => go(1)} aria-label="Next photo">
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {cur.credit && (
        <p className="lb-credit">
          Photo: {cur.credit} · {cur.license} ·{' '}
          <a href={cur.source} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
        </p>
      )}

      {n > 1 && (
        <div className="lb-thumbs" role="tablist" aria-label="Photos">
          {images.map((img, idx) => (
            <button key={img.url + idx} role="tab" aria-selected={idx === i} className={`lb-thumb ${idx === i ? 'on' : ''}`} onClick={() => setI(idx)}>
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </dialog>
  )
}
