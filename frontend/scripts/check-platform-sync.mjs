/**
 * Platform Sync Check
 *
 * Backend'de kayıtlı platform key'lerini çeker ve her birinin
 * frontend PLATFORM_LABELS'da tanımlı olup olmadığını doğrular.
 *
 * Çalıştırma:
 *   node scripts/check-platform-sync.mjs
 *
 * CI'da kullanım:
 *   BACKEND_URL=http://localhost:8000 node scripts/check-platform-sync.mjs
 *
 * Yeni platform eklenince bu script hem lokal hem CI'da fail eder
 * ve geliştiriciyi PLATFORM_LABELS'ı güncellemeye zorlar.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── PLATFORM_LABELS'ı helpers.ts'den statik olarak oku ──────────────────────

const helpersSource = readFileSync(path.join(ROOT, 'lib/helpers.ts'), 'utf-8')

// "PLATFORM_LABELS: Record<string, string> = { ... }" bloğunu parse et
const labelsMatch = helpersSource.match(/PLATFORM_LABELS[^=]*=\s*\{([^}]+)\}/s)
if (!labelsMatch) {
  console.error('❌  PLATFORM_LABELS could not be parsed from lib/helpers.ts')
  process.exit(1)
}

/** @type {Record<string, string>} */
const PLATFORM_LABELS = {}
for (const line of labelsMatch[1].split('\n')) {
  const m = line.match(/^\s*(\w+)\s*:\s*'([^']+)'/)
  if (m) PLATFORM_LABELS[m[1]] = m[2]
}

// ── Backend'den platform listesini çek ──────────────────────────────────────

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'

let backendPlatforms = []
try {
  const res = await fetch(`${backendUrl}/api/listings/?limit=1000&page=1`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()

  // Mevcut ilanlardan unique platform key'lerini topla
  const keys = new Set(
    (json.results ?? []).map((l) => l.source_platform).filter(Boolean)
  )
  backendPlatforms = [...keys]
} catch (err) {
  console.warn(`⚠️  Backend unreachable (${backendUrl}): ${err.message}`)
  console.warn('   Skipping live platform check — only static parse validated.')
  process.exit(0)
}

// ── Karşılaştır ──────────────────────────────────────────────────────────────

const knownKeys = new Set(Object.keys(PLATFORM_LABELS))
const missing = backendPlatforms.filter((k) => !knownKeys.has(k))

if (missing.length === 0) {
  console.log(`✅  All ${backendPlatforms.length} backend platforms are covered in PLATFORM_LABELS.`)
  console.log('   Keys:', backendPlatforms.join(', '))
  process.exit(0)
} else {
  console.error('❌  The following backend platforms are MISSING from PLATFORM_LABELS in lib/helpers.ts:')
  for (const key of missing) {
    console.error(`   - ${key}  (add: ${key}: 'Görünen İsim',)`)
  }
  console.error('\n   Fix: add the missing keys to frontend/lib/helpers.ts PLATFORM_LABELS.')
  process.exit(1)
}
