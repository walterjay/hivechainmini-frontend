// Turn raw chain / wallet errors into plain, friendly language.

const RULES: [RegExp, string][] = [
  [/\bRC\b|rc_plugin|resource credit|not enough rc|power up hive/i, 'Your energy is recharging. Please try again in a little while.'],
  [/cancel|declined|rejected|user_cancel|denied|refus/i, 'No problem, nothing was sent.'],
  [/once every 5 minutes|HIVE_MIN_ROOT_COMMENT_INTERVAL/i, 'You can share a new post every 5 minutes. Take a breather and try again soon.'],
  [/once every 3 seconds|HIVE_MIN_REPLY_INTERVAL|HIVE_MIN_VOTE_INTERVAL/i, 'Whoa, speedy! Wait a few seconds and try again.'],
  [/already voted|similar way/i, "You've already liked this one."],
  [/voting weight is too small|vote weight too small|dust/i, 'Your vote is still too small to count. It will grow as your account does.'],
  [/missing required posting authority|missing posting|authority/i, "That account couldn't sign this. Try logging out and back in."],
  [/expired|timeout|timed out/i, 'That took too long and timed out. Please try again.'],
  [/duplicate transaction/i, 'That was already sent.'],
  [/cannot reply|comment_cashout|paid out|archived/i, 'This conversation is closed for new replies.'],
  [/fetch|network|unreachable|HTTP \d/i, "We couldn't reach the Hive network. Check your connection and try again."],
]

export function friendlyError(e: unknown): string {
  const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : (e as { message?: string })?.message ?? ''
  for (const [re, text] of RULES) if (re.test(msg)) return text
  return 'Something went wrong. Please try again.'
}

export function isCancel(e: unknown) {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  return /cancel|declined|rejected|user_cancel|denied|refus/i.test(msg)
}
