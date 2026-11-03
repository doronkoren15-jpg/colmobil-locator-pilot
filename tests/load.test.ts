import { it, expect, vi, afterEach } from 'vitest'
import { loadDataset } from '../src/lib/load'
import { dataset } from './fixtures'
afterEach(() => vi.unstubAllGlobals())
it('loads and validates a local dataset', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(dataset())))
  vi.stubGlobal('fetch', fetcher)
  expect((await loadDataset('official')).kind).toBe('official')
  expect(fetcher.mock.calls[0][0]).toContain('data/official.json')
})
it('rejects HTTP failures, malformed JSON and a dataset of the wrong kind', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  await expect(loadDataset('official')).rejects.toThrow('503')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json')))
  await expect(loadDataset('official')).rejects.toThrow()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...dataset(), kind: 'demo' }))),
  )
  await expect(loadDataset('official')).rejects.toThrow('אינו תקין')
})
it('forwards the abort signal to fetch', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(dataset()))),
    controller = new AbortController()
  vi.stubGlobal('fetch', fetcher)
  await loadDataset('official', controller.signal)
  expect(fetcher.mock.calls[0][1].signal).toBe(controller.signal)
})
