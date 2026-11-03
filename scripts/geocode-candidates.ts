/** One-time, preparation-only geocoding for explicitly selected branch addresses.
 * Policy: https://operations.osmfoundation.org/policies/nominatim/
 * Single machine / single thread; >= 2 seconds between requests; persistent cache.
 * No autocomplete, scheduled jobs, client integration, or automatic verification.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { stringify } from 'csv-stringify/sync'
import { parseCsv } from './data-lib.ts'

const ids = process.argv.slice(2)
if (!ids.length || ids.length > 20)
  throw new Error('Pass 1–20 explicit location IDs. Read README and Nominatim usage policy first.')
const locations = parseCsv(await readFile('data/official/locations.csv', 'utf8'))
for (const id of ids)
  if (!locations.some((l) => l.location_id === id)) throw new Error(`Unknown location ID: ${id}`)
const directory = 'reports/geocoding'
await mkdir(`${directory}/cache`, { recursive: true })
const candidates: Record<string, string>[] = []
for (const id of [...new Set(ids)]) {
  const location = locations.find((l) => l.location_id === id)!
  const query = location.address
  const key = createHash('sha256').update(query).digest('hex')
  const path = `${directory}/cache/${key}.json`
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '3',
      countrycodes: 'il',
      'accept-language': 'he',
    }).toString()
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ColmobilLocatorDataPreparation/1.0 (one-time branch address review)',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}; stopped without retrying`)
    text = await response.text()
    JSON.parse(text)
    await writeFile(path, text)
    await setTimeout(2100)
  }
  const result: unknown = JSON.parse(text)
  if (!Array.isArray(result)) throw new Error('Unexpected geocoder response')
  for (const point of result)
    candidates.push({
      location_id: id,
      requested_address: query,
      returned_address: String(point.display_name || ''),
      lat: String(point.lat || ''),
      lng: String(point.lon || ''),
      coord_status: 'candidate',
      review_status: 'not_reviewed',
      provider: 'OpenStreetMap Nominatim',
      source_url: `https://www.openstreetmap.org/${point.osm_type}/${point.osm_id}`,
      retrieved_at: new Date().toISOString(),
      address_details: JSON.stringify(point.address || {}),
    })
}
await writeFile(
  `${directory}/candidates.csv`,
  stringify(candidates, {
    header: true,
    columns: [
      'location_id',
      'requested_address',
      'returned_address',
      'lat',
      'lng',
      'coord_status',
      'review_status',
      'provider',
      'source_url',
      'retrieved_at',
      'address_details',
    ],
  }),
)
console.log(
  `${candidates.length} candidates written; no production CSV was changed. Attribution: © OpenStreetMap contributors (ODbL).`,
)
