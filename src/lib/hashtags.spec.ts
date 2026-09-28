// Run with `npm test` (Node's built-in runner; no extra packages).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashtags, MAX_SNAP_TAGS, snapTags } from './hashtags.ts'

test('finds hashtags, lowercased, deduplicated, in order', () => {
  assert.deepEqual(hashtags('Sunset #Photography at the #lake\n#photography #hive-food'), ['photography', 'lake', 'hive-food'])
})

test('ignores URL fragments, markdown headings and punctuation after a tag', () => {
  assert.deepEqual(hashtags('# Title\nsee https://example.com/#section and #onchaintest.'), ['onchaintest'])
})

test('drops tags longer than Hive indexers keep', () => {
  assert.deepEqual(hashtags('#ok #' + 'a'.repeat(25)), ['ok'])
})

test('snap tags start with "snaps", like PeakD', () => {
  assert.deepEqual(snapTags('Testing #OnChainTest', false), ['snaps', 'onchaintest'])
  assert.deepEqual(snapTags('no tags here', false), ['snaps'])
})

test('a photo snap keeps "photo" even with many hashtags', () => {
  const body = Array.from({ length: 15 }, (_, i) => `#t${i}`).join(' ')
  const tags = snapTags(body, true)
  assert.equal(tags.length, MAX_SNAP_TAGS)
  assert.deepEqual(tags.slice(0, 3), ['snaps', 'photo', 't0'])
})

test('"#snaps" in the text is not repeated', () => {
  assert.deepEqual(snapTags('#snaps #Snaps hello', false), ['snaps'])
})
