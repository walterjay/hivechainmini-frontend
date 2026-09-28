import type { NSFWJS } from 'nsfwjs/core'
import { IMAGE_PROXY } from '../config'
import { looksUnsafe, type SafetyScores } from './photo-filters'

// On-device image safety check (NSFWJS, MobileNetV2, ~3.5 MB, loaded only
// when Photos opens). Pictures never leave the browser for this: the model
// runs locally on a small copy fetched through the Hive image proxy, which
// sends CORS headers so the pixels can be read.

let modelPromise: Promise<NSFWJS> | null = null

/** Loads the model once. Rejects if this device can't run it. */
export function loadSafetyModel(): Promise<NSFWJS> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, { load }, { MobileNetV2Model }] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('nsfwjs/core'),
        import('nsfwjs/models/mobilenet_v2'),
      ])
      tf.enableProdMode()
      return load('MobileNetV2', { modelDefinitions: [MobileNetV2Model] })
    })()
    modelPromise.catch(() => {
      modelPromise = null
    })
  }
  return modelPromise
}

async function scores(model: NSFWJS, el: HTMLImageElement | HTMLCanvasElement): Promise<SafetyScores> {
  const preds = await model.classify(el, 5)
  return Object.fromEntries(preds.map((p) => [p.className, p.probability]))
}

// Image downloads run a few at a time; the model itself works one image at a time anyway.
const MAX_PARALLEL = 3
const IMAGE_TIMEOUT_MS = 8000
let running = 0
const queue: (() => void)[] = []

/** Background tabs throttle timers so hard that every check would time out; wait until the page is back. */
function whenVisible() {
  if (document.visibilityState === 'visible') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const on = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', on)
      resolve()
    }
    document.addEventListener('visibilitychange', on)
  })
}

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((r) => queue.push(r))
  running++
  await whenVisible()
  try {
    return await fn()
  } finally {
    running--
    queue.shift()?.()
  }
}

async function checkUrl(model: NSFWJS, url: string): Promise<boolean> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.referrerPolicy = 'no-referrer'
  // The load event, not img.decode(): decode() never settles while the page isn't being rendered.
  // The timeout stops a stalled download from holding up the whole queue.
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Image timed out')), IMAGE_TIMEOUT_MS)
    img.onload = () => {
      clearTimeout(timer)
      resolve()
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Image failed to load'))
    }
    img.src = `${IMAGE_PROXY}/320x0/${url}`
  })
  return !looksUnsafe(await scores(model, img))
}

export type Verdict = 'safe' | 'unsafe' | 'failed'

const verdicts = new Map<string, Promise<Verdict>>()

/**
 * Scans one picture. 'failed' means it couldn't be downloaded or read in
 * time: it isn't shown either, but it isn't remembered as unsafe, so it can be
 * checked again later. Throws only if the model itself can't start, so the
 * page can explain that instead of showing nothing.
 */
export async function checkImage(url: string): Promise<Verdict> {
  const model = await loadSafetyModel()
  let v = verdicts.get(url)
  if (!v) {
    v = limited(() => checkUrl(model, url)).then(
      (ok): Verdict => (ok ? 'safe' : 'unsafe'),
      (): Verdict => {
        verdicts.delete(url)
        return 'failed'
      },
    )
    verdicts.set(url, v)
  }
  return v
}

/** Same check for a photo the user is about to upload (already drawn on a canvas). */
export async function isSafeCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
  const model = await loadSafetyModel()
  return !looksUnsafe(await scores(model, canvas))
}
