// Fails if anything that could render token value made it into the build.
// Run after `npm run build`. User-written post text is fetched at runtime, so it
// never appears here; this checks the app's own code and markup.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PATTERNS = [
  [/pending_payout_value|author_payout_value|curator_payout_value|total_payout_value|max_accepted_payout|payout_at|sum_pending/, 'reward field'],
  [/\bHBD\b/, 'HBD'],
  [/Hive Power|HIVE Power|\bVESTS\b/, 'Hive Power'],
  // A dollar amount like $1.23 (regex backreferences such as `$1` are fine).
  [/\bUSD\b|\bUS\$|\$\s?\d[\d,]*\.\d{2}\b/, 'dollar value'],
  [/\b\d+(?:\.\d+)?\s*HIVE\b/, 'HIVE amount'],
]

const files = []
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(js|html|css)$/.test(f)) files.push(p)
  }
}
walk('dist')

let bad = 0
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  for (const [re, label] of PATTERNS) {
    const m = text.match(re)
    if (m) {
      bad++
      const i = m.index ?? 0
      console.error(`✗ ${label} in ${f}: …${text.slice(Math.max(0, i - 60), i + 60)}…`)
    }
  }
}
if (bad) {
  console.error(`\n${bad} problem(s). Token value must not appear while SHOW_REWARDS is false.`)
  process.exit(1)
}
console.log(`✓ No token value or reward fields found in ${files.length} built files.`)
