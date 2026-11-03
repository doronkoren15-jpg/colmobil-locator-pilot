import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { convertCsv } from './data-lib.ts'
import { hasVerifiedCoordinates } from '../src/lib/locator.ts'
import { writeReport } from './report.ts'

await mkdir('public/data', { recursive: true })
await mkdir('reports', { recursive: true })
for (const kind of ['official', 'demo'] as const) {
  const [localities, locations, offerings] = await Promise.all(
    ['localities', 'locations', 'offerings'].map((n) => readFile(`data/${kind}/${n}.csv`, 'utf8')),
  )
  const data = convertCsv({ localities, locations, offerings }, kind, new Date().toISOString())
  const report = {
    kind,
    localities: data.localities.length,
    localities_with_coordinates: data.localities.filter(hasVerifiedCoordinates).length,
    locations: data.locations.length,
    rankable_locations: data.locations.filter(
      (l) =>
        l.active &&
        hasVerifiedCoordinates(l) &&
        data.offerings.some(
          (o) =>
            o.location_id === l.location_id &&
            o.status === 'active' &&
            o.verification === 'verified',
        ),
    ).length,
    offerings: data.offerings.length,
    excluded_localities: data.localities
      .filter((l) => !hasVerifiedCoordinates(l))
      .map((l) => ({ id: l.locality_id, name: l.name_he, reason: l.notes || l.coord_status })),
    excluded_locations: data.locations
      .filter((l) => !hasVerifiedCoordinates(l) || !l.active)
      .map((l) => ({ id: l.location_id, name: l.display_name, reason: l.notes || l.coord_status })),
    pending_offerings: data.offerings.filter(
      (o) => o.verification !== 'verified' || o.status !== 'active',
    ),
  }
  await writeFile(`public/data/${kind}.json`, JSON.stringify(data))
  await writeFile(`reports/${kind}-validation.json`, JSON.stringify(report, null, 2))
  if (kind === 'official') await writeReport(data)
  console.log(
    `${kind}: ${report.localities} localities (${report.localities_with_coordinates} located), ${report.locations} locations (${report.rankable_locations} rankable), ${report.offerings} offerings`,
  )
}
