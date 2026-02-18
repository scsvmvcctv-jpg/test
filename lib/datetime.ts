/**
 * Application timezone: Asia/Kolkata.
 * Use these helpers for consistent date/time display and "today" on both client and server.
 */
export const APP_TIMEZONE = 'Asia/Kolkata'

type DateInput = Date | string | number

function toDate(input: DateInput): Date {
  if (input instanceof Date) return input
  const d = new Date(input)
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`)
  return d
}

/**
 * Format a date in Asia/Kolkata for display.
 * Works on both client and server.
 */
export function formatInAppTz(
  date: DateInput,
  style: 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'yyyyMMdd' | 'full' = 'dd/MM/yyyy'
): string {
  const d = toDate(date)
  if (style === 'full') {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: APP_TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  }
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value?.padStart(2, '0') ?? ''
  const day = parts.find((p) => p.type === 'day')?.value?.padStart(2, '0') ?? ''
  if (style === 'dd/MM/yyyy') return `${day}/${m}/${y}`
  if (style === 'yyyy-MM-dd') return `${y}-${m}-${day}`
  if (style === 'yyyyMMdd') return `${y}${m}${day}`
  return `${day}/${m}/${y}`
}

/**
 * Today's date in Asia/Kolkata, formatted.
 * Use for CSV filenames, print headers, etc.
 */
export function getTodayInAppTz(style: 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'yyyyMMdd' = 'dd/MM/yyyy'): string {
  return formatInAppTz(new Date(), style)
}

/**
 * Current year in Asia/Kolkata (e.g. for copyright).
 */
export function getCurrentYearInAppTz(): number {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
  })
  return parseInt(formatter.format(new Date()), 10)
}

/**
 * Get the calendar date (YYYY-MM-DD) in Asia/Kolkata for a given instant.
 * Use when storing dates so the stored day matches the intended date in India.
 */
export function toDateOnlyInAppTz(date: Date): string {
  return formatInAppTz(date, 'yyyy-MM-dd')
}

const MONTH_NAMES: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
}

/**
 * Parse a CSV date string and return YYYY-MM-DD for that calendar date in Asia/Kolkata.
 * Avoids "one day earlier" bug when CSV has DD-MMM-YY (e.g. 19-Jan-26) and we store in UTC.
 */
export function parseCSVDateToAppTz(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null
  const s = dateStr.trim()
  if (!s) return null

  // DD-MMM-YY (e.g. 19-Jan-26) - was falling through to new Date() and becoming previous day in UTC
  const dmmYyMatch = s.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2})$/i)
  if (dmmYyMatch) {
    const [, day, mon, yy] = dmmYyMatch
    const month = MONTH_NAMES[mon.toUpperCase()]
    if (month !== undefined) {
      const y = parseInt(yy, 10)
      const year = y >= 0 && y <= 99 ? 2000 + y : y
      const d = parseInt(day, 10)
      if (d >= 1 && d <= 31) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }

  // DD-MMM-YYYY (e.g. 02-MAR-2026)
  const dmmYMatch = s.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})$/i)
  if (dmmYMatch) {
    const [, day, mon, year] = dmmYMatch
    const month = MONTH_NAMES[mon.toUpperCase()]
    if (month !== undefined) {
      const d = parseInt(day, 10)
      if (d >= 1 && d <= 31) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmYMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmYMatch) {
    const [, day, month, year] = dmYMatch
    const d = parseInt(day, 10)
    const m = parseInt(month, 10)
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${year}-${String(parseInt(month, 10)).padStart(2, '0')}-${String(parseInt(day, 10)).padStart(2, '0')}`
  }

  // Fallback: parse as date and take calendar day in Asia/Kolkata (fixes timezone shift)
  const date = new Date(s)
  if (isNaN(date.getTime())) return null
  return toDateOnlyInAppTz(date)
}
