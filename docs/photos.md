# Photos: a full-screen photo feed for Hive Chain Mini

Status: **prototype on branch `claude/photos`**, not deployed. Written 2026-09-28.

## The idea

A TikTok-style vertical feed, but only still pictures with a short description.
Swipe up for the next photo, swipe sideways when a post has several photos,
tap to upvote, comment, share or hide. It sits in its own top-level tab:
**Snaps · Photos · Posts**.

## Is there something like this already?

| App | What it is | Why it matters here |
| --- | --- | --- |
| **TikTok Photo Mode** | Swipeable photo carousels in the TikTok feed | Proves the "photo carousel + caption, swipe up" format works |
| **Lemon8** (ByteDance) | Image-first posts with short text | Closest in spirit: pictures lead, text is short |
| **Instagram** | The original photo feed | Grid + feed + full-screen viewer are the familiar patterns |
| **Flashes** (Bluesky) | A photo-only app built on an existing short-post network | **Closest model for us**: no new content, just a photo lens over Bluesky posts, the way Photos is a lens over Hive snaps |
| **Pixelfed** | Decentralized Instagram on the fediverse | Shows open networks can support a photo app |
| **Liketu** (on Hive) | Instagram-like Hive front end | Already exists on Hive; we include its posts as a source |

## Is it viable on Hive? (measured 2026-09-28)

**Content supply: yes, enough for a daily feed.**

- Snaps (`peak.snaps`): ~250 replies per container, ~170 with an image, but most are game bots.
  After filtering, **~25–30 real photos per container** (a container lasts about half a day).
- Waves (`ecency.waves`): ~180 replies per container, **~100 real photos**, almost all on Ecency's image host.
- Threads (`leothreads`): left out. Its images are mostly hot-linked from X or screenshot sites, and ~200 of
  1,160 replies came from accounts below reputation 25.
- Posts: `#photography` (~150/day), Photography Lovers (~10/day), `#liketu` (~25/day).

Together that is **a few hundred safe photos a day**: plenty for "what's happening on Hive today",
though not an infinite scroll. The feed goes back about 10 containers (several days).

**Safety: this is the hard part.** Snaps have no moderation layer, and only a few people tag
adult pictures as `nsfw`. The earlier prototype found an untagged nude from a day-old
account (reputation 11). So Photos uses layers, and anything that fails any check is left out:

1. **Metadata:** skip posts tagged `nsfw`, posts in NSFW communities, and posts muted or greyed out by community moderators.
2. **Trust:** skip authors below reputation 25 (that only happens when other users flag them).
3. **Content:** only photos on Hive's own image hosts (uploads there are signed by the poster's key).
   No hot-linked images, GIFs, videos or game/bot apps (hivegrove, mydempire, zingit, hivesuite, …).
4. **On-device AI scan:** every picture is scanned in the browser with [NSFWJS](https://github.com/infinitered/nsfwjs)
   (MobileNetV2) *before* it can appear. The thresholds are strict: a swimwear photo gets blocked too.
   Nothing is uploaded anywhere for this. If the scanner can't start, Photos shows nothing.
5. **User controls:** ⋯ → hide this photo / hide this person (remembered on the device).

The same scan runs on photos people upload, before they are sent.

**Cost:** the scanner adds ~2.5 MB (gzip) the first time Photos opens, then it is cached.
The rest of the app does not load it.

## What was built

- `/photos`: full-screen vertical feed with swipe carousels, filter chips (All / Snaps / Posts), upvote,
  comments, share, hide, and a 🛡️ panel explaining the checks.
- The feed stays as you left it for the whole visit: open a post, come back, and you're on the same photo.
  🔄 (or reloading the page) starts fresh.
- `/photos/new`: pick a photo → it's resized to 1600 px and re-encoded (which removes GPS location data) →
  scanned → short caption (300 characters max) → shared as a snap to Snaps or Waves, so it also shows in
  PeakD, Ecency and other Hive apps.
- Photo uploads need **Hive Keychain**. HiveAuth can't sign an image upload, so HiveAuth users see a notice.

## Code map

| File | What it does |
| --- | --- |
| `src/lib/photo-filters.ts` | The rules (hosts, bots, reputation, AI thresholds). Tested in `photo-filters.spec.ts` (`npm test`). |
| `src/lib/photos.ts` | Merges snap containers and photo tags into one newest-first feed. |
| `src/lib/safety.ts` | Loads the model on demand and scans images (fails closed). |
| `src/lib/upload.ts`, `src/auth/keychain.ts` | Resize/strip metadata, Keychain signing, upload to images.hive.blog. |
| `src/pages/Photos.tsx`, `src/pages/NewPhoto.tsx` | The two screens. |

## Not verified yet

- A **real** Keychain upload and post. It was tested only against a fake Keychain that records requests.
  The signing format matches what hive.blog sends to Keychain.
- Real phones (swipe feel, iOS Safari).

## Ideas for later

- Tune the thresholds on a larger sample. The scan can also run the bigger "Mid" model for fewer false alarms.
- A grid view of a person's photos on their profile.
- A shared blocklist (for example, hiding accounts muted by trusted communities).
- A name other than "Photos": *Moments*, *Shots* or *Frames* would work. The label is only in `Layout.tsx`.
