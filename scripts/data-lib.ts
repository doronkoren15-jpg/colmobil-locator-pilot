import { parse } from 'csv-parse/sync'
import { datasetSchema } from '../src/lib/schema.ts'
import type { Dataset } from '../src/lib/schema.ts'

export function parseCsv(text: string): Record<string, string>[] {
  return parse(text, {
    columns: (header) => {
      if (new Set(header).size !== header.length) throw new Error('Duplicate CSV headers')
      return header
    },
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  })
}
const number = (v: string) => (v === '' ? null : Number(v))
const boolean = (v: string) => {
  if (!['true', 'false'].includes(v)) throw new Error(`Invalid boolean: ${v}`)
  return v === 'true'
}
export function convertCsv(
  files: { localities: string; locations: string; offerings: string },
  kind: 'official' | 'demo',
  generatedAt: string,
): Dataset {
  return datasetSchema.parse({
    schema_version: 1,
    kind,
    generated_at: generatedAt,
    localities: parseCsv(files.localities).map((r) => ({
      ...r,
      aliases: JSON.parse(r.aliases),
      lat: number(r.lat),
      lng: number(r.lng),
    })),
    locations: parseCsv(files.locations).map((r) => ({
      ...r,
      active: boolean(r.active),
      lat: number(r.lat),
      lng: number(r.lng),
    })),
    offerings: parseCsv(files.offerings).map((r) => ({ ...r, brand: r.brand || null })),
  })
}
