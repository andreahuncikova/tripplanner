import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '@shared/types'
import { useAuth } from '../../auth/useAuth'
import { Avatar } from '../../components/ui'
import { SendIcon } from '../../components/layout/icons'
import { cn } from '../../lib/cn'
import type { TripChat } from '../../socket/useTripChat'

// Same limit as MESSAGE_MAX on the server.
const MESSAGE_MAX = 1000

// The group chat from the Chat and Desk-Chat mockups: a tab that fills the screen on phones,
// and the floating window on desktop (inWindow), where the messages sit on a lighter background with bordered bubbles.
// Photos and files come with the chat files task (Sprint 3).
export default function ChatPanel({ chat, inWindow }: { chat: TripChat; inWindow?: boolean }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const list = useRef<HTMLOListElement>(null)
  const inputId = useId()

  // Keep the newest message in view.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [chat.messages.length])

  function submit(e: FormEvent) {
    e.preventDefault()
    // Keep the text when it could not be sent yet (the trip is still opening)
    if (chat.send(text)) setText('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn('flex min-h-0 flex-1 flex-col', inWindow ? 'bg-chat' : 'bg-canvas')}>
        {/* The first item's mt-auto keeps a short chat at the bottom, next to the message field. */}
        <ol ref={list} aria-label="Messages" className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pt-4 pb-2 [&>:first-child]:mt-auto">
          {chat.messages.length === 0 && (
            <li className="mb-auto text-center text-sm text-muted">No messages yet. Say hi to the group!</li>
          )}
          {chat.messages.map((m, i) => (
            <Message key={i} message={m} mine={!m.system && m.userId === user?._id} inWindow={inWindow} />
          ))}
        </ol>

        <p aria-live="polite" className="min-h-6 px-4 pb-2 pl-13 text-caption text-muted">
          {chat.typing.length > 0 && `${chat.typing.join(', ')} ${chat.typing.length === 1 ? 'is' : 'are'} typing…`}
        </p>
      </div>

      <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-line bg-white px-3 py-2.5">
        <label htmlFor={inputId} className="sr-only">Message</label>
        {/* 16px text on phones, so iOS does not zoom in when the field gets focus. */}
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          placeholder="Message the group…"
          maxLength={MESSAGE_MAX}
          value={text}
          onChange={e => { setText(e.target.value); chat.notifyTyping() }}
          className={cn(
            'min-w-0 flex-1 rounded-full border border-line-strong bg-canvas px-3.5 text-base text-roche placeholder:text-faint lg:text-sm',
            'focus:border-sommet focus:outline-none focus:ring-1 focus:ring-sommet',
            inWindow ? 'py-2.75' : 'py-3',
          )}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || !chat.ready}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-sommet text-white hover:bg-sommet-dark disabled:opacity-50',
            inWindow ? 'size-10' : 'size-11',
          )}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}

function Message({ message: m, mine, inWindow }: { message: ChatMessage; mine: boolean; inWindow?: boolean }) {
  // From the server itself, e.g. "Group created" or "Mia left the group".
  if (m.system) {
    return (
      <li className="self-center rounded-full bg-line px-3 py-1.5 text-center text-xs font-semibold text-subtle">{m.text}</li>
    )
  }

  // wrap-anywhere also breaks a long word or link without spaces, which break-words leaves sticking out of the bubble
  const text = cn('max-w-full wrap-anywhere whitespace-pre-wrap px-3 py-2.5 leading-snug', inWindow ? 'text-sm' : 'text-md')
  const meta = <span className="text-xs font-bold text-muted">{mine ? 'You' : m.username} · {m.time}</span>

  // Your own messages on the right, with your avatar beside them as the others have theirs.
  // The avatar shows the profile photo once profiles have photos (Profile task).
  if (mine) {
    return (
      <li className="flex max-w-[85%] items-end gap-2 self-end">
        <div className="flex min-w-0 flex-col items-end gap-1">
          {meta}
          <p className={cn(text, 'rounded-lg rounded-br-[4px] bg-sommet text-white')}>{m.text}</p>
        </div>
        <Avatar name={m.username ?? '?'} color={m.color ?? '#5b6676'} size="sm" />
      </li>
    )
  }

  return (
    <li className="flex max-w-[85%] items-end gap-2">
      <Avatar name={m.username ?? '?'} color={m.color ?? '#5b6676'} size="sm" />
      <div className="flex min-w-0 flex-col gap-1">
        {meta}
        <p className={cn(text, 'rounded-lg rounded-bl-[4px] bg-white', inWindow && 'border border-line')}>{m.text}</p>
      </div>
    </li>
  )
}
