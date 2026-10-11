import { useRef, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import Lightbox from './Lightbox'

/**
 * Listing photos. Desktop: a large cover photo with up to four more beside it and a "Show all photos" button
 * (the layout adapts to however many photos there are). Phones: a swipeable strip with a counter.
 * Either way, tapping a photo opens the full-screen viewer.
 */
export default function Gallery({ images, title }) {
  const [open, setOpen] = useState(null) // index the viewer starts at, or null when closed
  const [page, setPage] = useState(0)
  const strip = useRef(null)
  if (!images?.length) return null
  const shown = images.slice(0, 5)

  return (
    <div className="gallery-wrap">
      <div className={`gallery g${shown.length}`}>
        {shown.map((img, i) => (
          <button key={img.url} className={`g-cell ${i === 0 ? 'g-main' : ''}`} onClick={() => setOpen(i)} aria-label={i === 0 ? `Open photos of ${title}` : `Open photo ${i + 1}`}>
            <img src={img.url} alt={i === 0 ? title : `${title}, photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
          </button>
        ))}
        {images.length > 1 && (
          <button className="g-all" onClick={() => setOpen(0)}>
            <LayoutGrid size={16} /> Show all {images.length} photos
          </button>
        )}
      </div>

      <div className="gallery-m">
        <div
          className="gm-strip"
          ref={strip}
          onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {images.map((img, i) => (
            <button key={img.url} className="gm-slide" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${images.length}`}>
              <img src={img.url} alt={i === 0 ? title : `${title}, photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
            </button>
          ))}
        </div>
        {images.length > 1 && <span className="gm-count">{page + 1} / {images.length}</span>}
      </div>

      {open !== null && <Lightbox images={images} start={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
