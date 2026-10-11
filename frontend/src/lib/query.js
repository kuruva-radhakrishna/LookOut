// The URL is the single source of truth for search state, so results are shareable and back/forward work.
// A page is whole rows of the grid: limit = columns x rows. Rows are multiples of 3, so the limit is always a multiple of 3
// (the API's rule) whatever the column count, and a row is never left half empty. Max 9 rows x 5 columns = 45.
export const ROWS = [3, 6, 9]
export const DEFAULT_ROWS = 3

export const SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rating', label: 'Top rated' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'newest', label: 'Newest' },
]

const int = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function readFilters(sp) {
  const rows = int(sp.get('rows'))
  return {
    q: sp.get('q') || '',
    category: sp.get('category') || '',
    minPrice: int(sp.get('minPrice')),
    maxPrice: int(sp.get('maxPrice')),
    minRating: Number(sp.get('minRating')) || null,
    sort: SORTS.some((s) => s.id === sp.get('sort')) ? sp.get('sort') : 'recommended',
    checkIn: sp.get('checkIn') || '',
    checkOut: sp.get('checkOut') || '',
    guests: int(sp.get('guests')),
    page: int(sp.get('page')) || 1,
    rows: ROWS.includes(rows) ? rows : DEFAULT_ROWS,
  }
}

/** Filters -> URLSearchParams for the browser URL (defaults are omitted to keep URLs short). */
export function writeFilters(f) {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.category) p.set('category', f.category)
  if (f.minPrice) p.set('minPrice', f.minPrice)
  if (f.maxPrice) p.set('maxPrice', f.maxPrice)
  if (f.minRating) p.set('minRating', f.minRating)
  if (f.sort && f.sort !== 'recommended') p.set('sort', f.sort)
  if (f.checkIn && f.checkOut) {
    p.set('checkIn', f.checkIn)
    p.set('checkOut', f.checkOut)
  }
  if (f.guests) p.set('guests', f.guests)
  if (f.page > 1) p.set('page', f.page)
  if (f.rows && f.rows !== DEFAULT_ROWS) p.set('rows', f.rows)
  return p
}

/** Filters -> API query string using limit/offset. `page` is only a UI concept: offset = (page - 1) * limit. The caller supplies `limit` (columns x rows). */
export function toApiQuery(f, overrides = {}) {
  const g = { ...f, ...overrides }
  const p = writeFilters({ ...g, page: 1 })
  p.set('limit', g.limit)
  p.set('offset', (g.page - 1) * g.limit)
  p.set('sort', g.sort)
  return p
}

/** How many refinements live in the Filters panel (category, search and dates have their own UI). */
export const panelFilterCount = (f) => (f.minPrice || f.maxPrice ? 1 : 0) + (f.minRating ? 1 : 0) + (f.sort !== 'recommended' ? 1 : 0)
