import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Castle, ChevronLeft, ChevronRight, Flame, Home, LayoutGrid, Mountain, Umbrella, Waves, Wheat } from 'lucide-react'

export const CATEGORIES = [
  { id: '', label: 'All stays', icon: LayoutGrid },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'rooms', label: 'Rooms', icon: Home },
  { id: 'mansion', label: 'Mansions', icon: Building2 },
  { id: 'castles', label: 'Castles', icon: Castle },
  { id: 'pools', label: 'Amazing pools', icon: Waves },
  { id: 'beaches', label: 'Beachfront', icon: Umbrella },
  { id: 'mountains', label: 'Mountains', icon: Mountain },
  { id: 'farmhouses', label: 'Farms', icon: Wheat },
]

export default function CategoryBar({ value, onChange }) {
  const scroller = useRef(null)
  const [edge, setEdge] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // keep the active category visible, e.g. after opening a shared link
  useEffect(() => {
    scroller.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [value])

  const scrollBy = (dx) => scroller.current?.scrollBy({ left: dx, behavior: 'smooth' })

  return (
    <div className="catbar">
      {edge.left && (
        <button className="catbar-arrow left" aria-label="Scroll categories left" onClick={() => scrollBy(-260)}>
          <ChevronLeft size={16} />
        </button>
      )}
      <div className="cats" role="tablist" aria-label="Stay types" ref={scroller} onScroll={measure}>
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={value === id} className={`cat ${value === id ? 'active' : ''}`} onClick={() => onChange(id)}>
            <Icon size={20} strokeWidth={1.6} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {edge.right && (
        <button className="catbar-arrow right" aria-label="Scroll categories right" onClick={() => scrollBy(260)}>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
