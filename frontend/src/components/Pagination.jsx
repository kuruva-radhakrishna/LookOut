import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PAGE_SIZES } from '../lib/query'

// 1 … 4 5 [6] 7 8 … 42
function pageList(page, pages) {
  const out = []
  const add = (n) => out.push(n)
  // first, last, and a window of five pages that slides with the current page
  const start = Math.max(1, Math.min(page - 2, pages - 4))
  const window = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i)
  const around = new Set([1, pages, ...window])
  let prev = 0
  for (const n of [...around].sort((a, b) => a - b)) {
    if (n - prev === 2) add(prev + 1) // a single gap is cheaper to show than "…"
    else if (n - prev > 2) add('gap' + n)
    add(n)
    prev = n
  }
  return out
}

export default function Pagination({ page, pages, total, limit, offset, itemCount, onPage, onLimit }) {
  if (!total) return null
  const from = offset + 1
  const to = offset + itemCount
  return (
    <nav className="pager" aria-label="Pagination">
      <p className="pager-count">
        Showing <strong>{from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')}</strong> of <strong>{total.toLocaleString('en-IN')}</strong> stays
      </p>

      {pages > 1 && (
        <ul className="pager-pages">
          <li>
            <button className="pager-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>
          </li>
          {pageList(page, pages).map((n) =>
            typeof n === 'string' ? (
              <li key={n} className="pager-gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={n}>
                <button className={`pager-btn ${n === page ? 'current' : ''}`} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`}>
                  {n}
                </button>
              </li>
            ),
          )}
          <li>
            <button className="pager-btn" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
              <ChevronRight size={16} />
            </button>
          </li>
        </ul>
      )}

      <label className="pager-size">
        <span>Per page</span>
        <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} aria-label="Stays per page">
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </nav>
  )
}
