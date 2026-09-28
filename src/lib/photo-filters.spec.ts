// Run with `npm test` (Node's built-in runner; no extra packages).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Post } from './hive.ts'
import { findImages, looksUnsafe, MAX_IMAGES, photoImages, rejectReason } from './photo-filters.ts'

const PEAKD = 'https://files.peakd.com/file/peakd-hive/alice/AbC123/sunset.jpg'
const HIVEIMG = 'https://images.hive.blog/DQmSaZTMYzpUFp9TGbxF7xxQWvNL9ofzQKaTw2A35VMRZnj/compose-1.jpg'

function snap(over: Partial<Post> = {}): Post {
  return {
    author: 'alice',
    permlink: 're-peaksnaps-abc',
    title: '',
    body: `Golden hour at the lake\n\n![sunset.jpg](${PEAKD})`,
    category: 'hive-178315',
    created: '2026-09-28T08:00:00',
    depth: 1,
    children: 0,
    active_votes: [],
    replies: [],
    json_metadata: { app: 'peakd/2026.9.1', tags: ['photography'] },
    author_reputation: 52.3,
    ...over,
  }
}

test('finds markdown, <img>, bare-link and metadata images once each', () => {
  const imgs = findImages({
    body: `![](${PEAKD})\n<img src="${HIVEIMG}" alt="lake">\n${PEAKD}`,
    json_metadata: { image: [HIVEIMG, 'https://i.ecency.com/DQmX/pic.webp'] },
  })
  assert.deepEqual(
    imgs.map((i) => i.url),
    [PEAKD, HIVEIMG, 'https://i.ecency.com/DQmX/pic.webp'],
  )
  assert.equal(imgs[1].alt, 'lake')
})

test('drops GIFs, video thumbnails and plain http', () => {
  const imgs = findImages({
    body: '![](https://files.peakd.com/x/dance.gif) ![](https://images.3speak.tv/thumb.jpg) ![](http://files.peakd.com/x/a.jpg)',
    json_metadata: {},
  })
  assert.equal(imgs.length, 0)
})

test('a normal photo snap passes', () => {
  assert.equal(rejectReason(snap()), null)
  assert.deepEqual(photoImages(snap()), [PEAKD])
})

test('low or missing reputation is rejected', () => {
  assert.equal(rejectReason(snap({ author_reputation: 11 })), 'low-reputation')
  assert.equal(rejectReason(snap({ author_reputation: undefined })), 'low-reputation')
  assert.equal(rejectReason(snap({ author_reputation: 25 })), null)
})

test('game and bot posts are rejected by app or tag', () => {
  assert.equal(rejectReason(snap({ json_metadata: { app: 'hivegrove/1.0' } })), 'bot')
  assert.equal(rejectReason(snap({ json_metadata: { app: 'peakd', tags: ['Splinterlands'] } })), 'bot')
})

test('video snaps are rejected', () => {
  assert.equal(rejectReason(snap({ body: `watch https://3speak.tv/watch?v=a/b\n![](${PEAKD})` })), 'video')
})

test('images from outside Hive hosts are not shown', () => {
  const p = snap({ body: '![](https://pbs.twimg.com/media/abc.jpg)' })
  assert.deepEqual(photoImages(p), [])
  assert.equal(rejectReason(p), 'no-photo')
})

test('screenshots are dropped from snaps but not from posts', () => {
  const body = `![Screenshot 2026-09-28.png](${PEAKD})`
  assert.deepEqual(photoImages(snap({ body })), [])
  assert.deepEqual(photoImages(snap({ body, depth: 0 })), [PEAKD])
})

test('carousel is capped', () => {
  const body = Array.from({ length: 9 }, (_, i) => `![](https://files.peakd.com/file/a/${i}.jpg)`).join('\n')
  assert.equal(photoImages(snap({ body })).length, MAX_IMAGES)
})

test('safety thresholds err on the side of hiding', () => {
  assert.equal(looksUnsafe({ Neutral: 0.95, Drawing: 0.03, Sexy: 0.02 }), false)
  assert.equal(looksUnsafe({ Neutral: 0.8, Porn: 0.16 }), true)
  assert.equal(looksUnsafe({ Neutral: 0.6, Sexy: 0.36 }), true)
  assert.equal(looksUnsafe({ Neutral: 0.5, Sexy: 0.2, Porn: 0.13, Hentai: 0.12 }), true)
  assert.equal(looksUnsafe({}), false)
})
