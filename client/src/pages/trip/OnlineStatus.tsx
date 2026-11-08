import type { OnlineUser } from '@shared/types'

// "● 3 online" under the trip name on the phone chat tab, with the names in the desktop chat window.
export default function OnlineStatus({ online, names }: { online: OnlineUser[]; names?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-caption text-success">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-online" />
      <span className="truncate">
        {online.length} online
        {names && online.length > 0 && ` · ${online.map(p => p.username).join(', ')}`}
      </span>
    </span>
  )
}
