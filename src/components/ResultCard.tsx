import { activityNames, brandNames } from '../lib/schema'
import type { Match } from '../lib/locator'
import { phoneHref, wazeHref } from '../lib/locator'

export function ResultCard({ match, rank, demo }: { match: Match; rank: number; demo: boolean }) {
  const { location, offerings, distance } = match
  const brands = [
    ...new Set(offerings.flatMap((o) => (o.brand ? [brandNames[o.brand] || o.brand] : []))),
  ]
  const contacts = offerings.filter(
    (o, i, all) => o.phone && all.findIndex((a) => a.phone === o.phone) === i,
  )
  const names = [...new Set(offerings.map((o) => o.display_name))],
    title = names[0]
  const navigation = wazeHref(location)
  return (
    <article className="result-card" data-testid="result-card">
      <div className="rank" aria-label={`תוצאה ${rank}`}>
        {String(rank).padStart(2, '0')}
      </div>
      <div className="branch-info">
        <div className="branch-tags">
          <span>{activityNames[offerings[0].activity]}</span>
          {brands.length > 0 && <span>{brands.join(' / ')}</span>}
        </div>
        <h3 title={names.join(' / ')}>{title}</h3>
        <p className="address">{location.address}</p>
        <div className="contacts">
          {contacts.length ? (
            contacts.map((o) => {
              const href = phoneHref(o.phone)
              return (
                <span className="contact" key={o.phone}>
                  {!demo && href ? (
                    <a href={href} aria-label={`חיוג ${o.phone}`}>
                      <span dir="ltr">{o.phone}</span>
                    </a>
                  ) : (
                    <span dir="ltr">{demo ? 'חיוג אינו זמין בהדגמה' : o.phone}</span>
                  )}
                  {contacts.length > 1 && o.brand && <small>{brandNames[o.brand]}</small>}
                </span>
              )
            })
          ) : (
            <span className="muted">טלפון אינו זמין</span>
          )}
        </div>
      </div>
      <div className="distance">
        <strong>
          {distance < 0.1
            ? 'פחות מ־0.1'
            : distance.toLocaleString('he-IL', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
        </strong>
        <span>ק״מ בקו אווירי</span>
      </div>
      <div className="result-actions">
        {!demo && navigation ? (
          <a
            href={navigation}
            className="waze-button"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`ניווט ב־Waze אל ${title}`}
          >
            ניווט ב־Waze <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <button disabled className="waze-button">
            ניווט מושבת בדמו
          </button>
        )}
        {!demo && (
          <a
            className="source-link"
            href={offerings[0].source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            מקור הפרטים
          </a>
        )}
      </div>
    </article>
  )
}
