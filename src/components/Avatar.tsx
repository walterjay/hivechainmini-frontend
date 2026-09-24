import { avatarUrl } from '../lib/hive'

export default function Avatar({ account, size = 32, className = '' }: { account: string; size?: number; className?: string }) {
  return (
    <img
      src={avatarUrl(account, size > 64 ? 'large' : size > 40 ? 'medium' : 'small')}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 rounded-full bg-zinc-200 object-cover dark:bg-zinc-800 ${className}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}
