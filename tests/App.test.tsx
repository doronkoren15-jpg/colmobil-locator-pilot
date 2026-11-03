import { beforeEach, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { loadDataset } from '../src/lib/load'
import { dataset, locality, offering } from './fixtures'
vi.mock('../src/lib/load', () => ({ loadDataset: vi.fn() }))
const loader = vi.mocked(loadDataset)
beforeEach(() => {
  loader.mockReset()
  loader.mockResolvedValue(dataset())
})
async function choose() {
  const input = await screen.findByRole('combobox', { name: 'יישוב הלקוח' })
  await userEvent.type(input, 'רענ')
  await userEvent.keyboard('{ArrowDown}{Enter}')
}
it('selects a Hebrew locality with the keyboard and updates results', async () => {
  render(<App />)
  await choose()
  expect(await screen.findAllByTestId('result-card')).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'נקודות מכירה ליד רעננה' })).toBeInTheDocument()
})
it('immediately switches activity, resets an incompatible brand, and preserves locality', async () => {
  render(<App />)
  await choose()
  await userEvent.selectOptions(screen.getByLabelText('מותג'), 'Hyundai')
  await userEvent.click(screen.getByRole('button', { name: 'טרייד אין' }))
  expect(screen.getByLabelText('מותג')).toHaveValue('')
  expect(screen.getByLabelText('מותג')).toBeDisabled()
  expect(screen.getByText('a-t')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'יישוב הלקוח' })).toHaveValue('רעננה')
})
it('offers one combined OMODA / JAECOO filter and keeps both matching brands', async () => {
  const d = dataset()
  d.offerings = [offering('omoda', 'A', 'new', 'OMODA'), offering('jaecoo', 'B', 'new', 'JAECOO')]
  loader.mockResolvedValue(d)
  render(<App />)
  await choose()
  expect(screen.queryByRole('option', { name: 'OMODA' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'JAECOO' })).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('מותג'), 'OMODA-JAECOO')
  expect(screen.getAllByTestId('result-card')).toHaveLength(2)
  await userEvent.click(screen.getByRole('button', { name: 'טרייד אין' }))
  expect(screen.getByLabelText('מותג')).toHaveValue('')
})
it('invalidates the selected locality on free-text editing', async () => {
  render(<App />)
  await choose()
  await userEvent.type(screen.getByRole('combobox', { name: 'יישוב הלקוח' }), 'x')
  expect(screen.queryAllByTestId('result-card')).toHaveLength(0)
  expect(screen.getByText('היישוב לא נמצא. נסו שם אחר או כתיב חלופי.')).toBeInTheDocument()
})
it('shows missing locality coordinates without ranking', async () => {
  loader.mockResolvedValue({
    ...dataset(),
    localities: [{ ...locality, lat: null, lng: null, coord_status: 'missing' }],
  })
  render(<App />)
  await choose()
  expect(screen.getByText('חסרה נקודת מיקום ליישוב הזה')).toBeInTheDocument()
  expect(screen.queryAllByTestId('result-card')).toHaveLength(0)
})
it('shows an empty state and can reset filters', async () => {
  const d = dataset()
  d.offerings = d.offerings.filter((o) => o.activity !== 'luxury')
  loader.mockResolvedValue(d)
  render(<App />)
  await choose()
  await userEvent.click(screen.getByRole('button', { name: 'יוקרה' }))
  expect(screen.getByText('אין נקודות מכירה מאומתות למסננים האלה')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'ניקוי מסנני הפעילות והמותג' }))
  expect(screen.getAllByTestId('result-card')).toHaveLength(1)
})
it('handles loading failure and retries successfully', async () => {
  loader.mockRejectedValueOnce(new Error('שגיאת בדיקה'))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('שגיאת בדיקה')
  await userEvent.click(screen.getByRole('button', { name: 'ניסיון חוזר' }))
  expect(await screen.findByLabelText('יישוב הלקוח')).toBeInTheDocument()
})
it('keeps demo data separate and disables outbound actions', async () => {
  const d = { ...dataset(), kind: 'demo' as const }
  loader.mockImplementation(async (kind) => (kind === 'demo' ? d : dataset()))
  render(<App />)
  await choose()
  await userEvent.click(screen.getByRole('button', { name: 'פתיחת מצב הדגמה' }))
  expect(await screen.findByText('מצב הדגמה בלבד')).toBeInTheDocument()
  expect(screen.queryAllByTestId('result-card')).toHaveLength(0)
  await choose()
  expect(screen.getByRole('button', { name: 'ניווט מושבת בדמו' })).toBeDisabled()
  expect(screen.queryByRole('link', { name: /חיוג/ })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'חזרה לנתוני אמת' }))
  await waitFor(() => expect(screen.queryByText('מצב הדגמה בלבד')).not.toBeInTheDocument())
})
it('renders correct phone and navigation targets for the filtered offering', async () => {
  render(<App />)
  await choose()
  await userEvent.selectOptions(screen.getByLabelText('מותג'), 'Hyundai')
  const card = screen.getAllByTestId('result-card')[0]
  expect(within(card).getByRole('link', { name: 'חיוג 03-1234567' })).toHaveAttribute(
    'href',
    'tel:031234567',
  )
  expect(within(card).getByRole('link', { name: /ניווט ב־Waze/ })).toHaveAttribute(
    'href',
    expect.stringContaining('ll=32.01,35'),
  )
})
