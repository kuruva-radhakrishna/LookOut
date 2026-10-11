import { Loader2 } from 'lucide-react'

export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="center-block" role="status">
      <Loader2 className="spin" size={28} />
      <span className="muted">{label}</span>
    </div>
  )
}
