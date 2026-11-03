import { datasetSchema } from './schema'
import type { Dataset } from './schema'

export async function loadDataset(
  kind: 'official' | 'demo',
  signal?: AbortSignal,
): Promise<Dataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${kind}.json`, {
    signal,
    cache: 'no-cache',
  })
  if (!response.ok) throw new Error(`טעינת הנתונים נכשלה (${response.status})`)
  const result = datasetSchema.safeParse(await response.json())
  if (!result.success || result.data.kind !== kind)
    throw new Error('קובץ הנתונים אינו תקין. יש לפנות לאחראי המאגר.')
  return result.data
}
