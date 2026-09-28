import { keychainSignImage } from '../auth/keychain'
import { IMAGE_PROXY } from '../config'

export interface PreparedPhoto {
  blob: Blob
  canvas: HTMLCanvasElement
  previewUrl: string
}

/**
 * Shrinks the photo to at most `maxEdge` pixels and re-encodes it as JPEG.
 * Re-encoding also drops the file's hidden metadata, including the GPS
 * position phones write into pictures, which would otherwise be public forever.
 */
export async function preparePhoto(file: File, maxEdge = 1600): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // transparent PNGs would otherwise turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo'))), 'image/jpeg', 0.86),
  )
  return { blob, canvas, previewUrl: URL.createObjectURL(blob) }
}

/** Uploads to Hive's image host (signed with Keychain) and returns the public URL. */
export async function uploadPhoto(account: string, blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const signature = await keychainSignImage(account, bytes)
  const form = new FormData()
  form.append('file', blob, `photo-${Date.now()}.jpg`)
  const res = await fetch(`${IMAGE_PROXY}/${account}/${signature}`, { method: 'POST', body: form })
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string | { name?: string } }
  if (res.ok && json.url) return json.url
  const reason = typeof json.error === 'string' ? json.error : (json.error?.name ?? `HTTP ${res.status}`)
  throw new Error(`Photo upload failed: ${reason}`)
}
