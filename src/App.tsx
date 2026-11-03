import { useEffect, useMemo, useState } from 'react'
import { LocalitySearch } from './components/LocalitySearch'
import { ResultCard } from './components/ResultCard'
import { availableBrands, findNearest, hasVerifiedCoordinates } from './lib/locator'
import { loadDataset } from './lib/load'
import { activities, activityNames, brandNames } from './lib/schema'
import type { Activity, Dataset, Locality } from './lib/schema'
import './App.css'

export default function App() {
  const [kind, setKind] = useState<'official' | 'demo'>('official'),
    [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0)
  const [locality, setLocality] = useState<Locality | null>(null),
    [activity, setActivity] = useState<Activity>('new'),
    [brand, setBrand] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    loadDataset(kind, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value)
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'טעינת הנתונים נכשלה')
      })
    return () => controller.abort()
  }, [kind, attempt])
  const brands = useMemo(() => (data ? availableBrands(data, activity) : []), [data, activity])
  const results = useMemo(
    () => (data && locality ? findNearest(data, locality, activity, brand) : null),
    [data, locality, activity, brand],
  )
  const rankable = useMemo(
    () =>
      data
        ? new Set(
            data.offerings
              .filter(
                (o) =>
                  o.verification === 'verified' &&
                  o.status === 'active' &&
                  data.locations.some(
                    (l) => l.location_id === o.location_id && l.active && hasVerifiedCoordinates(l),
                  ),
              )
              .map((o) => o.location_id),
          ).size
        : 0,
    [data],
  )
  const latestVerification = data?.offerings
    .map((o) => o.verified_at)
    .filter(Boolean)
    .sort()
    .at(-1)
  function changeKind() {
    setData(null)
    setError('')
    setLocality(null)
    setActivity('new')
    setBrand('')
    setKind((k) => (k === 'official' ? 'demo' : 'official'))
  }
  function changeActivity(next: Activity) {
    setActivity(next)
    if (!data || !availableBrands(data, next).includes(brand)) setBrand('')
  }
  function retry() {
    setError('')
    setData(null)
    setAttempt((n) => n + 1)
  }
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="wordmark">
            <span className="brand-symbol" aria-hidden="true">
              כ
            </span>
            <div>
              <strong>כלמוביל</strong>
              <span>איתור נקודות מכירה</span>
            </div>
          </div>
          <span className="internal-label">כלי עבודה לנציגי המכירות</span>
        </div>
      </header>
      <main>
        {kind === 'demo' && (
          <div role="status" className="demo-banner">
            <strong>מצב הדגמה בלבד</strong> · שמות ומיקומים סינתטיים לבדיקת הממשק. אינם מידע רשמי.
          </div>
        )}
        <section className="intro">
          <div>
            <h1>איתור נקודות מכירה</h1>
            <p>בחרו את יישוב הלקוח, ונמצא את נקודות המכירה המתאימות.</p>
          </div>
          <div className="intro-note">
            <span className="status-dot" />
            <span>
              חיפוש מקומי ומהיר
              <br />
              <small>ללא שיתוף פרטי הלקוח</small>
            </span>
          </div>
        </section>
        {error ? (
          <section className="empty-state error-state" role="alert">
            <h2>לא הצלחנו לטעון את המאגר</h2>
            <p>{error}</p>
            <button onClick={retry}>ניסיון חוזר</button>
          </section>
        ) : !data ? (
          <section className="empty-state" role="status">
            <h2>טוענים את מאגר נקודות המכירה…</h2>
          </section>
        ) : (
          <>
            <section className="filters" aria-label="חיפוש נקודת מכירה">
              <LocalitySearch
                key={kind}
                rows={data.localities}
                selected={locality}
                onSelect={setLocality}
              />
              <fieldset>
                <legend>סוג פעילות</legend>
                <div className="activity-switch">
                  {activities.map((a) => (
                    <button
                      key={a}
                      onClick={() => changeActivity(a)}
                      type="button"
                      aria-pressed={activity === a}
                    >
                      {activityNames[a]}
                    </button>
                  ))}
                </div>
                <span className="field-hint">מה הלקוח מחפש?</span>
              </fieldset>
              <div className="brand-filter">
                <label htmlFor="brand-filter">מותג</label>
                <select
                  id="brand-filter"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={!brands.length}
                >
                  <option value="">כל המותגים</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {brandNames[b] || b}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  {brands.length
                    ? 'סינון לפי המותגים בפעילות שנבחרה'
                    : 'אין שיוך מותג קבוע ומאומת לפעילות זו'}
                </span>
              </div>
            </section>
            <section className="results" aria-label="תוצאות חיפוש">
              <div className="results-heading">
                <div>
                  <h2>
                    {locality
                      ? `נקודות מכירה ליד ${locality.name_he}`
                      : 'מוצאים את נקודת המכירה המתאימה'}
                  </h2>
                  <p>
                    {locality && hasVerifiedCoordinates(locality)
                      ? 'עד 5 תוצאות · מרחק בקו אווירי מנקודת היישוב'
                      : 'כל המותגים והפעילויות, בחיפוש אחד'}
                  </p>
                </div>
                {results && locality && hasVerifiedCoordinates(locality) && (
                  <span className="result-count">{results.matches.length} תוצאות</span>
                )}
              </div>
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {locality
                  ? `${results?.matches.length || 0} תוצאות עבור ${locality.name_he}`
                  : 'בחרו יישוב להצגת תוצאות'}
              </div>
              {!locality ? (
                <div className="empty-state start-state">
                  <div className="empty-marker" aria-hidden="true">
                    ⌖
                  </div>
                  <h3>מאיפה הלקוח מגיע?</h3>
                  <p>
                    התחילו בהקלדת שם היישוב ובחרו אותו מהרשימה.
                    <br />
                    נקודות המכירה הקרובות יוצגו כאן מיד.
                  </p>
                </div>
              ) : !hasVerifiedCoordinates(locality) ? (
                <div className="empty-state" role="status">
                  <h3>חסרה נקודת מיקום ליישוב הזה</h3>
                  <p>היישוב נמצא במאגר, אך עדיין אין לו קואורדינטות מאומתות לחישוב מרחק.</p>
                </div>
              ) : results?.matches.length ? (
                <div className="result-list">
                  {results.matches.map((m, i) => (
                    <ResultCard
                      key={m.location.location_id}
                      match={m}
                      rank={i + 1}
                      demo={kind === 'demo'}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state" role="status">
                  <h3>אין נקודות מכירה מאומתות למסננים האלה</h3>
                  <p>נסו פעילות אחרת או את כל המותגים.</p>
                  <button
                    onClick={() => {
                      setBrand('')
                      setActivity('new')
                    }}
                  >
                    ניקוי מסנני הפעילות והמותג
                  </button>
                </div>
              )}
              {!!results?.excluded && (
                <p className="data-warning" role="status">
                  {results.excluded} מיקומים תואמים לא דורגו בגלל נתונים שטרם אומתו.
                </p>
              )}
            </section>
            <aside className="data-notice">
              <div className="notice-icon" aria-hidden="true">
                i
              </div>
              <p>
                <strong>המרחק הוא בקו אווירי, ולא מרחק נסיעה.</strong>
                <br />
                זמן ומסלול הנסיעה יופיעו ב־Waze. המאגר מבוסס על מקורות רשמיים; כיסוי חלקי ופרטים
                הדורשים אימות מפורטים בדוח הנתונים.
              </p>
            </aside>
            <footer className="data-footer">
              <span>
                {kind === 'official'
                  ? `${rankable} מיקומים זמינים לדירוג · ${data.localities.length.toLocaleString('he-IL')} יישובים במאגר`
                  : 'נתוני הדגמה סינתטיים בלבד'}
                <br />
                <small>
                  עדכון פרטים אחרון:{' '}
                  {kind === 'demo'
                    ? 'הדגמה'
                    : latestVerification
                      ? new Date(`${latestVerification}T00:00:00Z`).toLocaleDateString('he-IL')
                      : 'טרם אומת'}
                </small>
              </span>
              <div>
                {kind === 'official' && (
                  <a
                    href={`${import.meta.env.BASE_URL}data-status.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    מקורות ומצב הנתונים ↗
                  </a>
                )}
                <button className="text-button" onClick={changeKind}>
                  {kind === 'official' ? 'פתיחת מצב הדגמה' : 'חזרה לנתוני אמת'}
                </button>
              </div>
            </footer>
          </>
        )}
      </main>
      <div className="page-bottom">כלמוביל · איתור נקודות מכירה · לשימוש פנימי</div>
    </>
  )
}
