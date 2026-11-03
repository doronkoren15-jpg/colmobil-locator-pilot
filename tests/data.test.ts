import { readFileSync } from 'node:fs'
import { stringify } from 'csv-stringify/sync'
import { it, expect } from 'vitest'
import { convertCsv, parseCsv } from '../scripts/data-lib'
import { datasetSchema } from '../src/lib/schema'
import { dataset } from './fixtures'

const csv = (rows: unknown[]) => stringify(rows, { header: true })
function files() {
  const d = dataset()
  return {
    localities: csv(d.localities.map((l) => ({ ...l, aliases: JSON.stringify(l.aliases) }))),
    locations: csv(d.locations.map((l) => ({ ...l, active: String(l.active) }))),
    offerings: csv(d.offerings),
  }
}
it('round-trips editable CSV including BOM, quotes, commas and newlines', () => {
  const f = files()
  const d = convertCsv(f, 'official', '2026-11-03T00:00:00.000Z')
  expect(d.localities[0].name_he).toBe('רעננה')
  expect(parseCsv('\uFEFFid,name\r\n1,"שם, עם פסיק\nושורה"')[0].name).toContain('\n')
})
it('rejects duplicate headers and malformed CSV', () => {
  expect(() => parseCsv('a,a\n1,2')).toThrow()
  expect(() => parseCsv('a,b\n1,2,3')).toThrow()
})
it('rejects duplicate IDs and missing foreign keys', () => {
  const d = dataset()
  d.locations.push(d.locations[0])
  expect(datasetSchema.safeParse(d).success).toBe(false)
  d.locations.pop()
  d.offerings[0].location_id = 'unknown'
  expect(datasetSchema.safeParse(d).success).toBe(false)
})
it('rejects blank, non-finite or out of range verified coordinates', () => {
  const d = dataset()
  d.locations[0].lat = null
  expect(datasetSchema.safeParse(d).success).toBe(false)
  d.locations[0].lat = NaN
  expect(datasetSchema.safeParse(d).success).toBe(false)
  d.locations[0].lat = 203000
  expect(datasetSchema.safeParse(d).success).toBe(false)
})
it('rejects a verified point without provenance', () => {
  const d = dataset()
  d.locations[0].coord_source = ''
  expect(datasetSchema.safeParse(d).success).toBe(false)
})
it('rejects a mistakenly verified point at Null Island', () => {
  const d = dataset()
  d.locations[0].lat = 0
  d.locations[0].lng = 0
  expect(datasetSchema.safeParse(d).success).toBe(false)
})
it('ships no duplicate verified coordinates under different physical IDs', () => {
  const d = datasetSchema.parse(JSON.parse(readFileSync('public/data/official.json', 'utf8')))
  const keys = d.locations
    .filter((l) => l.coord_status === 'verified')
    .map((l) => `${l.lat!.toFixed(5)},${l.lng!.toFixed(5)}`)
  expect(new Set(keys).size).toBe(keys.length)
})
it('keeps genuine missing data without coercing blanks to zero', () => {
  const f = files()
  const d = dataset()
  d.locations[0] = { ...d.locations[0], lat: null, lng: null, coord_status: 'missing' }
  f.locations = csv(d.locations.map((l) => ({ ...l, active: String(l.active) })))
  expect(convertCsv(f, 'official', '2026-11-03T00:00:00.000Z').locations[0].lat).toBeNull()
})
it('validates both shipped datasets and all eight new-car brands', () => {
  for (const kind of ['official', 'demo']) {
    const d = datasetSchema.parse(JSON.parse(readFileSync(`public/data/${kind}.json`, 'utf8')))
    expect(d.kind).toBe(kind)
    if (kind === 'official')
      expect(
        new Set(d.offerings.filter((o) => o.activity === 'new').map((o) => o.brand)).size,
      ).toBe(8)
  }
})
