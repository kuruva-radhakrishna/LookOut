import { useLayoutEffect, useState } from 'react'

// These two numbers mirror `.grid { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); column-gap: 18px }`
// in index.css. Keep them in sync: the page size is derived from the column count so every row is full.
export const MIN_CARD = 230
export const GAP = 18

export const MAX_COLUMNS = 5 // .page-wide is at most 1400px wide, which fits 5 cards; also keeps 9 rows x 5 = 45 under the API's cap of 48

/** How many columns an auto-fill grid of MIN_CARD-wide cards gets in a container of this width. */
export const columnsFor = (width) => Math.min(MAX_COLUMNS, Math.max(1, Math.floor((width + GAP) / (MIN_CARD + GAP))))

/**
 * Narrow screens show fewer cards per row, so they get more rows to keep a page worthwhile (a phone with 1 column
 * and 3 rows would be 3 stays per page and 160+ pages). Multipliers are whole numbers, so rows stay a multiple of 3.
 */
export const rowMultiplier = (columns) => (columns >= 3 ? 1 : columns === 2 ? 2 : 3)

/** Stays per page for a size choice (3, 6 or 9 base rows): whole rows, always a multiple of 3. */
export const pageSize = (columns, baseRows) => columns * baseRows * rowMultiplier(columns)

/**
 * Live column count of the listing grid, measured from the element that holds it (and re-measured on resize,
 * rotation or sidebar changes). `null` until the first measurement, so callers don't fetch a page size they'd
 * immediately have to change.
 */
export function useGridColumns(ref) {
  const [cols, setCols] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setCols(columnsFor(el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return cols
}
