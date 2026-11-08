import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { AvatarGroup, Button, Input } from '../../components/ui'
import type { TripChat } from '../../socket/useTripChat'

// Same limit as MESSAGE_MAX on the server.
const MESSAGE_MAX = 1000

// The group chat, shown as a tab on phones and in the floating window on desktop.
// A plain working version of the socket events; the chat screen task gives it the mockup design.
export default function ChatPanel({ chat }: { chat: TripChat }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const list = useRef<HTMLOListElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [chat.messages.length])

  function submit(e: FormEvent) {
    e.preventDefault()
    chat.send(text)
    setText('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {chat.online.length > 0 && (
        <div className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-caption text-muted">
          <AvatarGroup people={chat.online.map(p => ({ name: p.username, color: p.color }))} size="sm" />
          {chat.online.length} online
        </div>
      )}

      <ol ref={list} aria-label="Messages" className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {chat.messages.length === 0 && <li className="m-auto text-sm text-muted">No messages yet.</li>}
        {chat.messages.map((m, i) => (
          m.system
            ? <li key={i} className="self-center text-caption text-muted">{m.text}</li>
            : (
              <li key={i} className={m.userId === user?._id ? 'self-end text-right' : 'self-start'}>
                <span className="text-caption text-muted">
                  <strong style={{ color: m.color }}>{m.username}</strong> · {m.time}
                </span>
                <p className="break-words whitespace-pre-wrap">{m.text}</p>
              </li>
            )
        ))}
      </ol>

      <p aria-live="polite" className="min-h-5 px-5 text-caption text-muted">
        {chat.typing.length > 0 && `${chat.typing.join(', ')} ${chat.typing.length === 1 ? 'is' : 'are'} typing…`}
      </p>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
        <div className="flex-1">
          <Input
            label="Message"
            hideLabel
            placeholder="Write a message"
            maxLength={MESSAGE_MAX}
            value={text}
            onChange={e => { setText(e.target.value); chat.notifyTyping() }}
          />
        </div>
        <Button type="submit" disabled={!text.trim()}>Send</Button>
      </form>
    </div>
  )
}
