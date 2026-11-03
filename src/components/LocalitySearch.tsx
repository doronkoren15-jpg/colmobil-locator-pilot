import { useId, useMemo, useState } from 'react'
import { searchLocalities } from '../lib/locator'
import type { Locality } from '../lib/schema'

export function LocalitySearch({
  rows,
  selected,
  onSelect,
}: {
  rows: Locality[]
  selected: Locality | null
  onSelect: (v: Locality | null) => void
}) {
  const id = useId(),
    [query, setQuery] = useState(''),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1)
  const options = useMemo(() => searchLocalities(rows, query), [rows, query])
  function choose(row: Locality) {
    setQuery(row.name_he)
    onSelect(row)
    setOpen(false)
    setActive(-1)
  }
  return (
    <div
      className="locality-control"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <label htmlFor={id}>יישוב הלקוח</label>
      <div className="search-input-wrap">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          placeholder="עיר, מושב או קיבוץ…"
          value={query}
          aria-autocomplete="list"
          aria-expanded={open && !!query}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            open && active >= 0 && options[active] ? `${id}-${active}` : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            onSelect(null)
            setOpen(true)
            setActive(-1)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => (options.length ? (a + 1) % options.length : -1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => (options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1))
            }
            if (e.key === 'Enter' && open && active >= 0 && options[active]) {
              e.preventDefault()
              choose(options[active])
            }
            if (e.key === 'Escape') {
              setOpen(false)
              setActive(-1)
            }
          }}
        />
        {query && (
          <button
            className="clear-input"
            aria-label="ניקוי היישוב"
            onClick={() => {
              setQuery('')
              onSelect(null)
              setOpen(false)
            }}
          >
            ×
          </button>
        )}
      </div>
      {open && query && (
        <div className="suggestions">
          <ul role="listbox" id={`${id}-list`} aria-label="יישובים תואמים">
            {options.map((row, i) => (
              <li
                key={row.locality_id}
                id={`${id}-${i}`}
                role="option"
                aria-selected={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row)}
                className={active === i ? 'active-option' : ''}
              >
                <span>{row.name_he}</span>
                <small>{row.coord_status === 'verified' ? 'יישוב' : 'מיקום חסר'}</small>
              </li>
            ))}
          </ul>
          {!options.length && <p role="status">היישוב לא נמצא. נסו שם אחר או כתיב חלופי.</p>}
        </div>
      )}
      <span className="field-hint">
        {selected ? 'היישוב נבחר · אפשר לשנות בכל רגע' : 'בחרו יישוב מתוך ההצעות כדי לחשב מרחקים'}
      </span>
    </div>
  )
}
