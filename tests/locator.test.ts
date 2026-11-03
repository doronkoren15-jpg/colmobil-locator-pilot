import { describe, it, expect } from 'vitest'
import {
  haversine,
  findNearest,
  normalize,
  phoneHref,
  wazeHref,
  searchLocalities,
  availableBrands,
  availableBrandFilters,
  combinedBrand,
} from '../src/lib/locator'
import { dataset, locality, location, offering } from './fixtures'

describe('Haversine WGS84', () => {
  it('returns zero for identical points', () =>
    expect(haversine({ lat: 32, lng: 35 }, { lat: 32, lng: 35 })).toBe(0))
  it('matches an independently known equatorial degree arc', () =>
    expect(haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.1950802335, 7))
  it('matches London–Paris and is symmetric', () => {
    const a = { lat: 51.5074, lng: -0.1278 },
      b = { lat: 48.8566, lng: 2.3522 }
    expect(haversine(a, b)).toBeCloseTo(343.5565, 2)
    expect(haversine(a, b)).toBe(haversine(b, a))
  })
  it('is finite at antipodes and crosses the antimeridian', () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(Math.PI * 6371.0088)
    expect(haversine({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 })).toBeCloseTo(22.239, 2)
  })
  it('rejects invalid coordinates', () => {
    expect(() => haversine({ lat: NaN, lng: 35 }, { lat: 32, lng: 35 })).toThrow()
    expect(() => haversine({ lat: 91, lng: 0 }, { lat: 0, lng: 0 })).toThrow()
  })
})
describe('locality lookup', () => {
  it('finds Hebrew prefixes and aliases', () => {
    expect(searchLocalities([locality], 'רענ')[0]).toEqual(locality)
    expect(searchLocalities([locality], 'raanana')[0]).toEqual(locality)
  })
  it('normalizes niqqud, quotation marks and dashes', () =>
    expect(normalize('  קִרְיַת־שְׁמוֹנָה ״א׳״ ')).toBe('קרית שמונה א'))
  it('returns none for unknown or empty input', () => {
    expect(searchLocalities([locality], '')).toEqual([])
    expect(searchLocalities([locality], 'אינו קיים')).toEqual([])
  })
  it('ranks exact names ahead of partial matches', () => {
    expect(
      searchLocalities(
        [{ ...locality, locality_id: '2', name_he: 'רעננה דרום' }, locality],
        'רעננה',
      )[0].locality_id,
    ).toBe('1')
  })
})
describe('activity–brand filtering and deduplication', () => {
  it('does not infer trade or luxury from a new-car brand', () => {
    const d = dataset()
    expect(findNearest(d, locality, 'trade', 'Hyundai').matches).toHaveLength(0)
    expect(
      findNearest(d, locality, 'new', 'Hyundai').matches[0].offerings.map((o) => o.offering_id),
    ).toEqual(['a'])
  })
  it('returns a multi-brand location once and preserves matched offerings', () => {
    const r = findNearest(dataset(), locality, 'new', '')
    expect(r.matches).toHaveLength(1)
    expect(r.matches[0].offerings).toHaveLength(2)
  })
  it('filters inactive, planned, pending and unverified records', () => {
    const d = dataset()
    d.offerings[0].status = 'planned'
    d.offerings[1].verification = 'pending'
    expect(findNearest(d, locality, 'new', '').matches).toHaveLength(0)
    d.offerings[0].status = 'active'
    d.locations[0].active = false
    expect(findNearest(d, locality, 'new', '').matches).toHaveLength(0)
  })
  it('excludes missing or candidate coordinates even when numbers exist', () => {
    const d = dataset()
    d.locations[0].coord_status = 'candidate'
    const r = findNearest(d, locality, 'new', '')
    expect(r.matches).toEqual([])
    expect(r.excluded).toBe(1)
    expect(
      findNearest(
        dataset(),
        { ...locality, coord_status: 'missing', lat: null, lng: null },
        'new',
        '',
      ).matches,
    ).toEqual([])
  })
  it('sorts precise distances before rounding and limits to three', () => {
    const d = dataset()
    d.locations = Array.from({ length: 7 }, (_, i) => location(String(i), 32 + (7 - i) * 0.00001))
    d.offerings = d.locations.map((l) => offering(l.location_id, l.location_id))
    const r = findNearest(d, locality, 'new', '')
    expect(r.matches.map((m) => m.location.location_id)).toEqual(['6', '5', '4'])
    expect(r.total).toBe(7)
  })
  it('combines OMODA and JAECOO filters without changing canonical brands', () => {
    const d = dataset()
    d.offerings = [offering('o', 'A', 'new', 'OMODA'), offering('j', 'B', 'new', 'JAECOO')]
    expect(availableBrands(d, 'new')).toEqual(['JAECOO', 'OMODA'])
    expect(availableBrandFilters(d, 'new')).toEqual([combinedBrand])
    expect(
      findNearest(d, locality, 'new', combinedBrand).matches.map((m) => m.location.location_id),
    ).toEqual(['A', 'B'])
    expect(findNearest(d, locality, 'trade', combinedBrand).matches).toHaveLength(0)
    d.offerings[1].verification = 'pending'
    expect(findNearest(d, locality, 'new', combinedBrand).matches).toHaveLength(1)
  })
  it('returns a shared OMODA and JAECOO location once and excludes unrelated brands', () => {
    const d = dataset()
    d.offerings = [
      offering('o', 'A', 'new', 'OMODA'),
      offering('j', 'A', 'new', 'JAECOO'),
      offering('h', 'B', 'new', 'Hyundai'),
    ]
    const matches = findNearest(d, locality, 'new', combinedBrand).matches
    expect(matches).toHaveLength(1)
    expect(matches[0].offerings.map((o) => o.brand)).toEqual(['OMODA', 'JAECOO'])
    d.offerings = [offering('j', 'A', 'new', 'JAECOO')]
    expect(availableBrandFilters(d, 'new')).toEqual([combinedBrand])
  })
  it('breaks exact distance ties deterministically', () => {
    const d = dataset()
    d.locations = [location('B'), location('A')]
    d.offerings = [offering('b', 'B'), offering('a', 'A')]
    expect(findNearest(d, locality, 'new', '').matches.map((m) => m.location.location_id)).toEqual([
      'A',
      'B',
    ])
  })
  it('derives brands per activity without making a null brand a wildcard', () => {
    expect(availableBrands(dataset(), 'trade')).toEqual([])
    expect(availableBrands(dataset(), 'new')).toHaveLength(2)
  })
})
describe('navigation and phone links', () => {
  it('uses verified branch coordinates in Waze', () => {
    const url = new URL(wazeHref(location('A'))!)
    expect(url.searchParams.get('ll')).toBe('32.01,35')
    expect(url.searchParams.get('navigate')).toBe('yes')
    expect(wazeHref({ ...location('A'), coord_status: 'candidate' })).toBeNull()
  })
  it('supports Israeli numbers and star short codes without guessing shorthand', () => {
    expect(phoneHref('03-1234567')).toBe('tel:031234567')
    expect(phoneHref('3314*')).toBe('tel:*3314')
    expect(phoneHref('04-6093021/2')).toBeNull()
    expect(phoneHref('javascript:alert(1)')).toBeNull()
  })
})
