import { useState } from 'react'
import Dialog from './Dialog'

const PRESETS = [10, 25, 50, 100]

/** Lets accounts with a heavy vote pick how strong this upvote is. Shows percent only, never value. */
export default function VoteStrengthDialog({ initial, onVote, onClose }: { initial: number; onVote: (percent: number) => void; onClose: () => void }) {
  const [pct, setPct] = useState(initial)
  return (
    <Dialog title="How strong is this upvote?" onClose={onClose}>
      <p className="text-sm text-muted">Your upvotes carry a lot of weight. Pick a strength; we’ll remember it for next time.</p>
      <p className="mt-5 text-center text-4xl font-extrabold tabular-nums" aria-live="polite">
        {pct}%
      </p>
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        aria-label="Upvote strength in percent"
        className="mt-3 w-full accent-brand"
      />
      <div className="mt-3 flex justify-center gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={`chip ${pct === p ? 'chip-on' : 'chip-off'}`} aria-pressed={pct === p} onClick={() => setPct(p)}>
            {p}%
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onVote(pct)} autoFocus>
          Upvote at {pct}%
        </button>
      </div>
    </Dialog>
  )
}
