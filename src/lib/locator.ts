import { brandNames } from './schema'
import type { Activity, Dataset, Locality, Location, Offering } from './schema'

export const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .toLocaleLowerCase('he')
    .replace(/\p{M}/gu, '')
    .replace(/[׳״'"‘’“”]/g, '')
    .replace(/[־–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function searchLocalities(rows: Locality[], query: string, limit = 12): Locality[] {
  const q = normalize(query)
  if (!q) return []
  return rows
    .map((row) => {
      const names = [row.name_he, ...row.aliases].map(normalize)
      const score = names.some((n) => n === q)
        ? 0
        : names.some((n) => n.startsWith(q))
          ? 1
          : names.some((n) => n.includes(q))
            ? 2
            : 3
      return { row, score }
    })
    .filter((r) => r.score < 3)
    .sort((a, b) => a.score - b.score || a.row.name_he.localeCompare(b.row.name_he, 'he'))
    .slice(0, limit)
    .map((r) => r.row)
}

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  for (const p of [a, b])
    if (
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lng) ||
      Math.abs(p.lat) > 90 ||
      Math.abs(p.lng) > 180
    )
      throw new Error('Invalid WGS84 coordinates')
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}
export function hasVerifiedCoordinates(
  p: Locality | Location,
): p is (Locality | Location) & { lat: number; lng: number } {
  return (
    p.coord_status === 'verified' &&
    p.lat !== null &&
    p.lng !== null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng)
  )
}
export interface Match {
  location: Location
  offerings: Offering[]
  distance: number
}
export function availableBrands(data: Dataset, activity: Activity): string[] {
  return [
    ...new Set(
      data.offerings
        .filter(
          (o) =>
            o.activity === activity &&
            o.status === 'active' &&
            o.verification === 'verified' &&
            o.brand,
        )
        .map((o) => o.brand!),
    ),
  ].sort((a, b) => (brandNames[a] || a).localeCompare(brandNames[b] || b, 'he'))
}
export const combinedBrand = 'OMODA-JAECOO'
export function brandFilterLabel(brand: string): string {
  return brand === combinedBrand ? 'OMODA / JAECOO' : brandNames[brand] || brand
}
export function availableBrandFilters(data: Dataset, activity: Activity): string[] {
  return [
    ...new Set(
      availableBrands(data, activity).map((brand) =>
        brand === 'OMODA' || brand === 'JAECOO' ? combinedBrand : brand,
      ),
    ),
  ].sort((a, b) => brandFilterLabel(a).localeCompare(brandFilterLabel(b), 'he'))
}
function matchesBrand(offering: Offering, brand: string): boolean {
  if (!brand) return true
  return brand === combinedBrand
    ? offering.brand === 'OMODA' || offering.brand === 'JAECOO'
    : offering.brand === brand
}
export function findNearest(
  data: Dataset,
  locality: Locality,
  activity: Activity,
  brand: string,
): { matches: Match[]; excluded: number; total: number } {
  if (!hasVerifiedCoordinates(locality)) return { matches: [], excluded: 0, total: 0 }
  const grouped = new Map<string, Offering[]>()
  for (const o of data.offerings) {
    if (o.status !== 'active' || o.activity !== activity || !matchesBrand(o, brand)) continue
    grouped.set(o.location_id, [...(grouped.get(o.location_id) || []), o])
  }
  const matches: Match[] = []
  let excluded = 0
  for (const location of data.locations) {
    const offerings = grouped.get(location.location_id)
    if (!offerings?.length || !location.active) continue
    const verified = offerings.filter((o) => o.verification === 'verified')
    if (!verified.length || !hasVerifiedCoordinates(location)) {
      excluded++
      continue
    }
    matches.push({ location, offerings: verified, distance: haversine(locality, location) })
  }
  matches.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.location.display_name.localeCompare(b.location.display_name, 'he') ||
      a.location.location_id.localeCompare(b.location.location_id),
  )
  return { matches: matches.slice(0, 3), excluded, total: matches.length }
}
export function phoneHref(raw: string): string | null {
  const phone = raw.replace(/[\s()-]/g, '')
  if (/^\d{3,5}\*$/.test(phone)) return `tel:*${phone.slice(0, -1)}`
  return /^(?:\+972\d{8,9}|0\d{8,9}|\*\d{3,5})$/.test(phone) ? `tel:${phone}` : null
}
export function wazeHref(location: Location): string | null {
  return hasVerifiedCoordinates(location)
    ? `https://www.waze.com/ul?ll=${location.lat},${location.lng}&navigate=yes&zoom=17`
    : null
}
