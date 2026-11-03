import { z } from 'zod'

export const activities = ['new', 'trade', 'luxury'] as const
export const activityNames = { new: 'רכב חדש', trade: 'טרייד אין', luxury: 'יוקרה' }
export const brandNames: Record<string, string> = {
  Hyundai: 'יונדאי',
  Mitsubishi: 'מיצובישי',
  JAECOO: 'JAECOO',
  OMODA: 'OMODA',
  ORA: 'ORA',
  'Mercedes-Benz': 'מרצדס־בנץ',
  Genesis: 'ג׳נסיס',
  smart: 'smart',
}
const text = z.string().trim().min(1)
const date = z.iso.date()
const url = z.url().refine((v) => /^https?:\/\//.test(v), 'נדרש קישור HTTP או HTTPS')
const coordinateFields = {
  lat: z.number().finite().min(-90).max(90).nullable(),
  lng: z.number().finite().min(-180).max(180).nullable(),
  coord_status: z.enum(['verified', 'candidate', 'missing', 'conflict']),
  coord_source: z.string(),
  coord_method: z.string(),
  coord_verified_at: z.union([date, z.literal('')]),
  notes: z.string(),
}
function checkCoordinates(
  v: {
    lat: number | null
    lng: number | null
    coord_status: string
    coord_source: string
    coord_verified_at: string
    coord_method: string
  },
  ctx: z.RefinementCtx,
) {
  if ((v.lat === null) !== (v.lng === null))
    ctx.addIssue({ code: 'custom', message: 'נדרש זוג קואורדינטות או שני ערכים חסרים' })
  if (
    v.coord_status === 'verified' &&
    (v.lat === null || v.lng === null || !v.coord_source || !v.coord_verified_at || !v.coord_method)
  )
    ctx.addIssue({
      code: 'custom',
      message: 'קואורדינטות מאומתות מחייבות נקודה, מקור, שיטה ותאריך',
    })
  if (v.coord_status === 'missing' && v.lat !== null)
    ctx.addIssue({ code: 'custom', message: 'סטטוס missing מחייב נקודה ריקה' })
  if (
    v.coord_status === 'verified' &&
    v.lat !== null &&
    v.lng !== null &&
    (v.lat < 28 || v.lat > 34 || v.lng < 33 || v.lng > 37)
  )
    ctx.addIssue({ code: 'custom', message: 'נקודה מאומתת נמצאת מחוץ לתחום הגיאוגרפי הנתמך' })
}
export const localitySchema = z
  .object({
    locality_id: text,
    name_he: text,
    aliases: z.array(text),
    source_url: url,
    source_date: date,
    ...coordinateFields,
  })
  .strict()
  .superRefine(checkCoordinates)
export const locationSchema = z
  .object({
    location_id: text,
    display_name: text,
    address: text,
    city: text,
    active: z.boolean(),
    ...coordinateFields,
  })
  .strict()
  .superRefine(checkCoordinates)
export const offeringSchema = z
  .object({
    offering_id: text,
    location_id: text,
    display_name: text,
    activity: z.enum(activities),
    brand: z.string().nullable(),
    operator: z.string(),
    phone: z.string(),
    status: z.enum(['active', 'inactive', 'planned', 'pending']),
    verification: z.enum(['verified', 'pending', 'conflict']),
    source_url: url,
    verified_at: z.union([date, z.literal('')]),
    notes: z.string(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.activity === 'new' && !v.brand)
      ctx.addIssue({ code: 'custom', message: 'רכב חדש מחייב מותג' })
    if (v.brand && !Object.hasOwn(brandNames, v.brand))
      ctx.addIssue({ code: 'custom', message: 'מותג לא מוכר' })
    if (v.verification === 'verified' && !v.verified_at)
      ctx.addIssue({ code: 'custom', message: 'פרטים מאומתים מחייבים תאריך' })
  })
export const datasetSchema = z
  .object({
    schema_version: z.literal(1),
    kind: z.enum(['official', 'demo']),
    generated_at: z.iso.datetime(),
    localities: z.array(localitySchema),
    locations: z.array(locationSchema),
    offerings: z.array(offeringSchema),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const [label, rows, key] of [
      ['יישובים', v.localities, 'locality_id'],
      ['מיקומים', v.locations, 'location_id'],
      ['פעילויות', v.offerings, 'offering_id'],
    ] as const) {
      const ids = rows.map((r) => (r as unknown as Record<string, string>)[key])
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', message: `מזהים כפולים: ${label}` })
    }
    const ids = new Set(v.locations.map((l) => l.location_id))
    for (const o of v.offerings)
      if (!ids.has(o.location_id))
        ctx.addIssue({ code: 'custom', message: `קישור למיקום חסר: ${o.offering_id}` })
  })
export type Activity = (typeof activities)[number]
export type Locality = z.infer<typeof localitySchema>
export type Location = z.infer<typeof locationSchema>
export type Offering = z.infer<typeof offeringSchema>
export type Dataset = z.infer<typeof datasetSchema>
