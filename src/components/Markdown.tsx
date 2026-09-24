import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { renderMarkdown } from '../lib/markdown'

/** Renders sanitized markdown. All HTML goes through DOMPurify in renderMarkdown. */
export default function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  const navigate = useNavigate()
  return (
    <div
      className={`post-body prose prose-zinc max-w-none dark:prose-invert prose-a:text-brand prose-img:rounded-xl ${className}`}
      // In-app links (/u/…, /p/…) navigate without a full page reload.
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a')
        const href = a?.getAttribute('href')
        if (href?.startsWith('/') && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault()
          navigate(href)
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
