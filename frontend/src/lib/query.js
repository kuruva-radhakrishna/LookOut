// The URL is the single source of truth for search state, so results are shareable and back/forward work.
export const PAGE_SIZES = [15, 30, 45] // multiples of 3 and 5: whole rows in a five-column grid (and a three-column one)
export const DEFAULT_LIMIT = 15

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
  const limit = int(sp.get('limit'))
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
    limit: PAGE_SIZES.includes(limit) ? limit : DEFAULT_LIMIT,
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
  if (f.limit && f.limit !== DEFAULT_LIMIT) p.set('limit', f.limit)
  return p
}

/** Filters -> API query string using limit/offset. `page` is only a UI concept: offset = (page - 1) * limit. */
export function toApiQuery(f, overrides = {}) {
  const g = { ...f, ...overrides }
  const p = writeFilters({ ...g, page: 1, limit: DEFAULT_LIMIT })
  p.set('limit', g.limit)
  p.set('offset', (g.page - 1) * g.limit)
  p.set('sort', g.sort)
  return p
}

/** How many refinements live in the Filters panel (category, search and dates have their own UI). */
export const panelFilterCount = (f) => (f.minPrice || f.maxPrice ? 1 : 0) + (f.minRating ? 1 : 0) + (f.sort !== 'recommended' ? 1 : 0)
