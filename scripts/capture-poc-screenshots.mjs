/**
 * Capture POC screenshots for all logbook modules.
 *
 * Usage:
 *   npm run poc:screenshots
 *
 * Environment:
 *   POC_BASE_URL          Default http://localhost:3000
 *   POC_HEADLESS          Set to 1 for headless (default 1)
 *   POC_USER / POC_PASSWORD   Staff credentials (default mock-password-123 on localhost)
 *   POC_ADMIN_USER / POC_ADMIN_PASSWORD   Optional HOD/Dean login for /admin screenshot
 *   POC_LOGIN_WAIT_MS     Manual login wait when auto-login disabled (default 120000)
 *   POC_MANUAL_LOGIN      Set to 1 to wait for manual login instead of auto-login
 */

import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'docs', 'poc', 'screenshots')
const BASE_URL = process.env.POC_BASE_URL || 'http://localhost:3000'
const HEADLESS = process.env.POC_HEADLESS !== '0'
const MANUAL_LOGIN = process.env.POC_MANUAL_LOGIN === '1'
const LOGIN_WAIT_MS = Number(process.env.POC_LOGIN_WAIT_MS || 120000)
const STAFF_USER = process.env.POC_USER || 'demo'
const STAFF_PASSWORD = process.env.POC_PASSWORD || 'mock-password-123'

const PUBLIC_PAGES = [
  {
    file: '01-login-staff.png',
    path: '/login',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Staff' }).click().catch(() => {})
    },
  },
  {
    file: '02-login-supervisor.png',
    path: '/login',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Supervisor' }).click().catch(() => {})
    },
  },
  { file: '03-officer-login.png', path: '/officer-login' },
  { file: '04-admin-login.png', path: '/admin-login' },
  { file: '05-forgot-password.png', path: '/forgot-password' },
]

const AUTH_PAGES = [
  { file: '06-dashboard.png', path: '/dashboard' },
  { file: '07-workload.png', path: '/workload' },
  { file: '08-lecture-plan.png', path: '/lecture-plan' },
  { file: '09-tests.png', path: '/tests' },
  { file: '10-assignments.png', path: '/assignments' },
  { file: '11-extra-classes.png', path: '/extra-classes' },
  { file: '12-theory-assessment.png', path: '/assessment/theory' },
  { file: '13-practical-assessment.png', path: '/assessment/practical' },
  { file: '14-inspections.png', path: '/inspections' },
  { file: '15-profile.png', path: '/profile' },
  { file: '16-admin-dashboard.png', path: '/admin', requiresAdmin: true },
]

function solveCaptcha(question) {
  const match = question.match(/(\d+)\s*([+\-×])\s*(\d+)/)
  if (!match) return null
  const n1 = parseInt(match[1], 10)
  const n2 = parseInt(match[3], 10)
  switch (match[2]) {
    case '+':
      return n1 + n2
    case '-':
      return n1 - n2
    case '×':
      return n1 * n2
    default:
      return null
  }
}

async function readCaptchaAnswer(page) {
  const question = await page.locator('span.text-lg.font-bold.text-gray-700').first().textContent()
  if (!question) return null
  return solveCaptcha(question.replace('=', '').trim())
}

async function capture(page, file, urlPath, setup) {
  await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'networkidle', timeout: 60000 })
  if (setup) await setup(page)
  await page.waitForTimeout(1500)

  const current = page.url()
  const onLoginRedirect =
    current.includes('/login') &&
    !urlPath.includes('login') &&
    urlPath !== '/admin-login'

  if (onLoginRedirect) {
    console.warn(`Skipped ${file}: redirected to login (${current})`)
    return false
  }

  const out = path.join(OUT_DIR, file)
  await page.screenshot({ path: out, fullPage: true })
  console.log(`Saved ${out}`)
  return true
}

async function autoStaffLogin(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Staff' }).click().catch(() => {})
  await page.fill('#email', STAFF_USER)
  await page.fill('#password', STAFF_PASSWORD)

  const answer = await readCaptchaAnswer(page)
  if (answer == null) throw new Error('Could not parse captcha')
  await page.fill('#captcha', String(answer))

  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30000 }),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ])
  console.log('Staff login successful')
}

async function manualStaffLogin(page) {
  console.log(`\nPlease log in at ${BASE_URL}/login in the browser window.`)
  console.log(`Waiting up to ${LOGIN_WAIT_MS / 1000}s for /dashboard ...`)
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.waitForURL(/\/dashboard/, { timeout: LOGIN_WAIT_MS })
}

async function injectAdminSession(page) {
  const adminUser = process.env.POC_ADMIN_USER
  const adminPass = process.env.POC_ADMIN_PASSWORD
  if (!adminUser || !adminPass) {
    console.warn('Skipped admin dashboard: set POC_ADMIN_USER and POC_ADMIN_PASSWORD')
    return false
  }

  const res = await page.request.post(`${BASE_URL}/api/admin-login`, {
    data: { UserId: adminUser, password: adminPass, UserType: 'Officers' },
  })
  const data = await res.json()
  if (!res.ok() || !data.token) {
    console.warn('Admin login failed:', data.error || res.status())
    return false
  }

  await page.goto(`${BASE_URL}/admin-login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ token, admin }) => {
    localStorage.setItem('adminToken', token)
    localStorage.setItem('adminData', JSON.stringify(admin))
  }, { token: data.token, admin: data.admin })

  console.log('Admin session injected')
  return true
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: HEADLESS })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Headless: ${HEADLESS}`)

  console.log('Capturing public pages...')
  for (const item of PUBLIC_PAGES) {
    await capture(page, item.file, item.path, item.setup)
  }

  try {
    if (MANUAL_LOGIN) {
      await manualStaffLogin(page)
    } else {
      await autoStaffLogin(page)
    }
  } catch (err) {
    console.error('Staff login failed:', err.message)
    console.error('Set POC_MANUAL_LOGIN=1 to sign in manually, or POC_USER/POC_PASSWORD for real credentials.')
    await browser.close()
    process.exit(1)
  }

  console.log('Capturing authenticated module pages...')
  const hasAdmin = await injectAdminSession(page)

  for (const item of AUTH_PAGES) {
    if (item.requiresAdmin && !hasAdmin) continue
    try {
      await capture(page, item.file, item.path)
    } catch (err) {
      console.warn(`Skipped ${item.file}:`, err.message)
    }
  }

  await browser.close()
  console.log('\nDone. Screenshots saved to docs/poc/screenshots/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
