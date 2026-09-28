import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { IMAGE_PROXY } from '../config'
import { timeAgo } from '../lib/hive'
import type { PhotoItem } from '../lib/photos'
import Avatar from './Avatar'
import { postPath } from './PostCard'

/** The call to action that opens the whole post: wording differs for snaps (short, with replies) and posts. */
export function fullPostLabel(item: PhotoItem) {
  return item.post.depth > 0 ? '💬 Open the snap & replies' : '📖 Read the full post'
}

const ZOOM = 2.5

interface Zoom {
  /** Clicked point, as a fraction of the picture. */
  fx: number
  fy: number
  w: number
  h: number
}

/** Where the picture actually sits inside an object-contain <img>. */
function contentBox(img: HTMLImageElement) {
  const r = img.getBoundingClientRect()
  const scale = Math.min(r.width / (img.naturalWidth || 1), r.height / (img.naturalHeight || 1))
  const w = (img.naturalWidth || r.width) * scale
  const h = (img.naturalHeight || r.height) * scale
  return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, w, h }
}

/**
 * Full-screen view of one post's photos: swipe or use the arrows between
 * them, tap to zoom in where you tapped, drag to look around, tap again to
 * zoom back out.
 */
export default function PhotoLightbox({ item, start, onClose }: { item: PhotoItem; start: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const zoomLayer = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const [index, setIndex] = useState(start)
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const p = item.post
  const count = item.images.length

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [])

  useLayoutEffect(() => {
    const el = strip.current
    if (el) el.scrollLeft = start * el.clientWidth
  }, [start])

  // Centre the zoomed picture on the point that was tapped.
  useLayoutEffect(() => {
    const el = zoomLayer.current
    if (!el || !zoom) return
    el.scrollLeft = zoom.fx * zoom.w - el.clientWidth / 2
    el.scrollTop = zoom.fy * zoom.h - el.clientHeight / 2
  }, [zoom])

  function go(i: number) {
    const el = strip.current
    if (!el || i < 0 || i >= count) return
    setZoom(null)
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  function zoomIn(e: MouseEvent<HTMLImageElement>) {
    const box = contentBox(e.currentTarget)
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    setZoom({ fx: clamp((e.clientX - box.left) / box.w), fy: clamp((e.clientY - box.top) / box.h), w: box.w * ZOOM, h: box.h * ZOOM })
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = zoomLayer.current
    if (!el || e.pointerType !== 'mouse') return // touch already pans natively
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = zoomLayer.current
    if (!d || !el) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true
    el.scrollLeft = d.left - dx
    el.scrollTop = d.top - dy
  }

  const ctrl = 'grid h-11 w-11 place-items-center rounded-full bg-black/50 text-lg text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white'

  return (
    <dialog
      ref={dialog}
      aria-label={`Photo by @${p.author}`}
      onCancel={(e) => {
        e.preventDefault()
        if (zoom) setZoom(null)
        else onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(index - 1)
        if (e.key === 'ArrowRight') go(index + 1)
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div
        ref={strip}
        className={`flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] ${zoom ? 'invisible' : ''}`}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {item.images.map((url, i) => (
          <div key={url} className="grid h-full w-full shrink-0 snap-center place-items-center">
            <img
              src={`${IMAGE_PROXY}/2048x0/${url}`}
              alt={count > 1 ? `Photo ${i + 1} of ${count} by @${p.author}` : `Photo by @${p.author}`}
              referrerPolicy="no-referrer"
              draggable={false}
              className="h-full w-full cursor-zoom-in object-contain"
              onClick={zoomIn}
            />
          </div>
        ))}
      </div>

      {zoom && (
        <div
          ref={zoomLayer}
          className="absolute inset-0 cursor-grab overflow-auto overscroll-contain [scrollbar-width:none] active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            const moved = drag.current?.moved
            drag.current = null
            if (!moved) setZoom(null)
          }}
          onPointerLeave={() => (drag.current = null)}
        >
          <div className="grid min-h-full min-w-full place-items-center" style={{ width: 'max-content' }}>
            <img
              src={`${IMAGE_PROXY}/2048x0/${item.images[index]}`}
              alt=""
              referrerPolicy="no-referrer"
              draggable={false}
              style={{ width: zoom.w, height: zoom.h, maxWidth: 'none' }}
            />
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pb-8">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold backdrop-blur">
          {zoom ? 'Drag to look around · tap to zoom out' : `${count > 1 ? `${index + 1} / ${count} · ` : ''}Tap the photo to zoom`}
        </span>
        <button className={`pointer-events-auto ml-auto ${ctrl}`} aria-label="Close" onClick={onClose} autoFocus>
          ✕
        </button>
      </div>

      {!zoom && count > 1 && (
        <>
          {index > 0 && (
            <button className={`absolute top-1/2 left-3 -translate-y-1/2 ${ctrl}`} aria-label="Previous photo" onClick={() => go(index - 1)}>
              ‹
            </button>
          )}
          {index < count - 1 && (
            <button className={`absolute top-1/2 right-3 -translate-y-1/2 ${ctrl}`} aria-label="Next photo" onClick={() => go(index + 1)}>
              ›
            </button>
          )}
        </>
      )}

      {!zoom && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-3 bg-gradient-to-t from-black/85 to-transparent px-4 pt-12 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link to={`/u/${p.author}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold hover:underline">
            <Avatar account={p.author} size={32} />
            <span className="truncate">@{p.author}</span>
            <span className="font-normal text-white/60">· {timeAgo(p.created)}</span>
          </Link>
          <Link to={postPath(p)} className="btn-primary w-full sm:ml-auto sm:w-auto">
            {fullPostLabel(item)} →
          </Link>
        </div>
      )}
    </dialog>
  )
}
