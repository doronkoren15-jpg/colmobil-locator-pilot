import { writeFile } from 'node:fs/promises'
import type { Dataset } from '../src/lib/schema.ts'
import { activityNames, brandNames } from '../src/lib/schema.ts'
import { hasVerifiedCoordinates, phoneHref } from '../src/lib/locator.ts'

const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
export async function writeReport(data: Dataset) {
  const located = data.localities.filter(hasVerifiedCoordinates).length
  const missingLocalities = data.localities.filter((l) => !hasVerifiedCoordinates(l))
  const missingLocations = data.locations.filter((l) => !l.active || !hasVerifiedCoordinates(l))
  const unclickable = data.offerings.filter((o) => o.phone && !phoneHref(o.phone))
  const unresolved = data.offerings.filter(
    (o) => o.verification !== 'verified' || o.status !== 'active',
  )
  const coverage = Object.entries(brandNames).map(([brand, name]) => {
    const rows = data.offerings.filter((o) => o.activity === 'new' && o.brand === brand)
    return {
      brand: name,
      records: rows.length,
      rankable: new Set(
        rows
          .filter(
            (o) =>
              o.status === 'active' &&
              o.verification === 'verified' &&
              data.locations.some(
                (l) => l.location_id === o.location_id && l.active && hasVerifiedCoordinates(l),
              ),
          )
          .map((o) => o.location_id),
      ).size,
      source: rows[0]?.source_url || '',
    }
  })
  const csvMarkdown = coverage
    .map((c) => `| ${c.brand} | ${c.records} | ${c.rankable} | [מקור](${c.source}) |`)
    .join('\n')
  const remaining = ['trade', 'luxury'].map((activity) => {
    const rows = data.offerings.filter((o) => o.activity === activity)
    return {
      activity,
      name: activityNames[activity as 'trade' | 'luxury'],
      active: rows.filter((o) => o.status === 'active' && o.verification === 'verified').length,
      pending: rows.filter((o) => o.status !== 'active' || o.verification !== 'verified').length,
      source: rows.find((o) => o.status === 'active')?.source_url,
    }
  })
  const overview = `מאגר ראשוני ממקורות רשמיים; אינו אישור לשלמות ארגונית. ${data.localities.length} יישובים, ${located} עם נקודה מאומתת, ${missingLocalities.length} ללא נקודה. ${data.locations.length} מיקומים ו-${data.offerings.length} קשרי פעילות–מותג.`
  const principles = [
    'מועד איסוף פרטי הסניפים: 03.11.2026. רשימות המותגים נקראו בדפדפן Chrome מן הדפים הרשמיים החיים; קריאה ישירה ב-HTTP נחסמה ב-403. דפי סניפים נבדקו במדגם בלבד; אין לטעון שכל דף פרטני נבדק.',
    'קואורדינטות סניפים נלקחו מקישור Waze הצמוד לאותה כתובת ושם ברשימה הרשמית. נבדקו תקינות WGS84 והתאמה לתחום היישוב (עד 25 ק״מ מנקודת היישוב). זהו אימות מקור והתאמה בסיסית, ללא מדידת GPS בשטח או אימות כניסת החניה.',
    'כל 146 הרשומות החיות הכילו קישור קואורדינטות רשמי. לכן לא הופעל גיאוקודינג חיצוני באיסוף זה. כלי אופציונלי ליצירת מועמדי גיאוקודינג נמסר בנפרד; אינו מסמן תוצאות כמאומתות.',
    'רשימת היישובים מבוססת על רשות האוכלוסין (1316 רשומות). העשרת נקודות לפי סמל יישוב מקובץ הלמ״ס 2023; נקודות ITM הומרו באמצעות pyproj 3.7.2 מ-EPSG:2039 ל-EPSG:4326. שנת הנתונים הגיאוגרפיים היא 2023; תאריך הבדיקה אינו שנת עדכון הנקודות.',
    'בקובץ הלמ״ס יש גם אזורים מנהליים. הם לא נוספו כחיפושי יישוב; הבסיס הוא רשימת רשות האוכלוסין. שמות חלופיים מהמקורות נשמרו, ונוספו קיצורים מוכרים כגון מודיעין ותל אביב.',
    'איחוד מותגים בוצע עבור אותו יישוב, כתובת מנורמלת ויעד ניווט רשמי תואם (עד 150 מטר). אין איחוד לפי עיר, מותג או מרחק לבדם. כל רשומות המקור והמיזוגים נשמרו בדוחות CSV. כתובות שונות סמוכות נשארו נפרדות עד אישוש נוסף.',
    'יוקרה היא פעילות טרייד יוקרה. מכירת רכב חדש של Genesis או Mercedes-Benz אינה משייכת אתר אוטומטית ליוקרה. מותגי מלאי משתנה לא מופו לזמינות קבועה בטרייד או ביוקרה.',
    'מתחם טרייד חולון נשמר מקובץ ההתחלה כ-pending ואינו מדורג משום שלא נמצא ברשימת הטרייד החיה שנקראה. אין להסיק מכך שהסניף נסגר. נשר יוקרה אינו נוסף כפעיל על בסיס אזכור ״בקרוב״.',
    'פערים מול קובץ הפתיחה: ORA — 20 רשומות במקום 19; Genesis — 3 במקום 2; טרייד — 15 רשומות חיות לעומת 16 בקובץ ההתחלה. מספרי המקור משמשים לבקרת כיסוי בלבד.',
    'שמות מפעילים משפטיים לא תמיד מופיעים ברשימות. מפעיל ריק נשאר ריק; אין לנחש מפעיל על סמך המותג. טלפונים שנבדקו אומתו מול הפרסום, ללא שיחת ניסיון.',
    'בדפי זכייני JAECOO ו-OMODA באילת נמצאו סתירות בין טלפוני הכותרת, פרטי הקשר וקישורי החיוג. שתי רשומות המותג מסומנות conflict ומוחרגות מהדירוג עד בירור, אף שהמיקום עצמו משמש מותגים אחרים. ראיות מפורטות: reports/source-conflicts.csv.',
    'כתובות שונות סמוכות הדורשות בדיקת זהות מתחם מופיעות ב-reports/possible-duplicates.csv. בפרט, ישעיהו ליבוביץ 7 והסדנאות 10 בהרצליה: טלפון אולם זהה ואזכור חניה משותפת במקור, אך כתובות ויעדי ניווט שונים. נדרש אישוש ארגוני לפני איחוד; כרגע נשמרים כשני אתרים.',
  ]
  const markdown = `# דוח נתונים ופערים — כלמוביל\n\n${overview}\n\n## כיסוי רכב חדש\n\n| מותג | רשומות | מיקומים זמינים לדירוג | מקור |\n|---|---:|---:|---|\n${csvMarkdown}\n\n${remaining.map((r) => `${r.name}: ${r.active} רשומות פעילות, ${r.pending} טעונות אימות. [מקור](${r.source})`).join('\n\n')}\n\n## שיטת אימות ומגבלות\n\n${principles.map((p) => '- ' + p).join('\n')}\n\n## רשומות פעילות–מותג מוחרגות\n\n${unresolved.map((o) => `- ${o.display_name}: ${o.verification} / ${o.status}. ${o.notes}`).join('\n')}\n\n## מיקומים שאינם מדורגים\n\n${missingLocations.map((l) => `- ${l.display_name}: ${l.notes}`).join('\n') || 'אין'}\n\n## טלפונים הדורשים בירור\n\n${unclickable.map((o) => `- ${o.display_name}: ${o.phone}. נשמר טקסט המקור ללא יצירת קישור חיוג.`).join('\n') || 'אין'}\n\n## יישובים ללא קואורדינטות\n\n${missingLocalities.map((l) => `- ${l.name_he} (${l.locality_id}): ${l.notes}`).join('\n')}\n\n## לפני שימוש מבצעי\n\nיש לאשר מול בעל המאגר הארגוני את שלמות רשימת הזכיינים והאולמות, סטטוסים, שמות מפעילים, כתובות כניסה ופרטי קשר; להשלים יישובים חסרי נקודות; ולבחון מחדש מקורות סותרים. האפליקציה אינה מחייבת שהמאגר יהיה מלא כדי לפעול, אך כל תוצאה מחייבת נתונים מאומתים לפי השיטה המתועדת.\n`
  await writeFile('reports/data-gaps.md', markdown)
  const rows = coverage
    .map(
      (c) =>
        `<tr><td>${escape(c.brand)}</td><td>${c.records}</td><td>${c.rankable}</td><td><a href="${escape(c.source)}" target="_blank" rel="noopener noreferrer">מקור רשמי</a></td></tr>`,
    )
    .join('')
  const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כלמוביל — מצב הנתונים</title><style>body{font:16px/1.8 Arial,sans-serif;max-width:1000px;margin:40px auto;padding:0 22px;color:#193b48;background:#f5f7f8}h1{font-size:28px}h2{font-size:21px;margin-top:32px}table{border-collapse:collapse;width:100%;background:white;font-size:14px}td,th{padding:10px;border:1px solid #d4dfe4;text-align:right}a{color:#25694f}li{margin-bottom:12px}p{max-width:85ch}.table-wrap{overflow:auto}</style><a href="./">חזרה לאיתור נקודות מכירה</a><h1>מקורות ומצב הנתונים</h1><p>${escape(overview)}</p><h2>כיסוי אולמות רכב חדש</h2><div class="table-wrap"><table><thead><tr><th>מותג</th><th>רשומות</th><th>מיקומים לדירוג</th><th>מקור</th></tr></thead><tbody>${rows}</tbody></table></div><p>${remaining.map((r) => `${escape(r.name)}: ${r.active} רשומות פעילות, ${r.pending} טעונות אימות`).join('<br>')}</p><h2>שיטת האימות והמגבלות</h2><ul>${principles.map((p) => `<li>${escape(p)}</li>`).join('')}</ul><h2>מיקומים שלא דורגו</h2><ul>${missingLocations.map((l) => `<li>${escape(l.display_name)} — ${escape(l.notes)}</li>`).join('')}</ul><h2>טלפונים הדורשים בירור</h2><ul>${unclickable.map((o) => `<li>${escape(o.display_name)} — <bdi>${escape(o.phone)}</bdi></li>`).join('') || '<li>אין</li>'}</ul><h2>${missingLocalities.length} יישובים ללא נקודה</h2><p>${missingLocalities.map((l) => escape(l.name_he)).join(' · ')}</p><h2>לפני שימוש מבצעי</h2><p>נדרש אישור בעל המאגר לשלמות הכיסוי, לסטטוסים ולפרטי הסניפים. יש להשלים את הפערים המפורטים כאן. מועד יצירת קובצי האפליקציה: <bdi>${escape(data.generated_at)}</bdi>.</p></html>`
  const unresolvedSection = `<h2>רשומות פעילות–מותג שהוחרגו</h2><ul>${unresolved.map((o) => `<li>${escape(o.display_name)} — ${escape(o.verification)} / ${escape(o.status)}. ${escape(o.notes)}</li>`).join('')}</ul>`
  await writeFile(
    'public/data-status.html',
    html.replace('<h2>מיקומים שלא דורגו</h2>', `${unresolvedSection}<h2>מיקומים שלא דורגו</h2>`),
  )
}
