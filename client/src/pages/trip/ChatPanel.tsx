import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import type { ChatFile, ChatMessage, LinkPreview, Member, UploadedFile } from '@shared/types'
import { useAuth } from '../../auth/useAuth'
import { Avatar, useToast } from '../../components/ui'
import { AttachIcon, CloseIcon, FileIcon, SendIcon } from '../../components/layout/icons'
import { cn } from '../../lib/cn'
import { CHAT_FILE_MAX, CHAT_FILE_TYPES, deleteUpload, fileSrc, formatSize, uploadFile } from '../../lib/files'
import type { TripChat } from '../../socket/useTripChat'
import type { TripStays } from '../../socket/useTripStays'
import { formatPrice, platformName } from './stayFormat'
import PhotoCarousel from './PhotoCarousel'
import OsmCredit from './OsmCredit'

// Same limit as MESSAGE_MAX on the server.
const MESSAGE_MAX = 1000

// A photo or PDF picked for the next message. It uploads straight away, so Send only waits for the text;
// uploaded stays null until the server has it. preview is a local address of the photo, shown while it uploads.
interface Attachment {
  name: string
  isImage: boolean
  preview: string | null
  uploaded: UploadedFile | null
}

// The group chat from the Chat and Desk-Chat mockups: a tab that fills the screen on phones,
// and the floating window on desktop (inWindow), where the messages sit on a lighter background with bordered bubbles.
// Photos and PDFs are sent with the paperclip, or pasted into the message field.
// stays: lets a link card save its link to the Stays tab
// `members` gives each message the current profile photo of who wrote it
export default function ChatPanel({ chat, inWindow, stays, members }: { chat: TripChat; inWindow?: boolean; stays?: TripStays; members?: Member[] }) {
  const { user } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  // The attachment now, for an upload that finishes after it was removed or replaced
  const current = useRef<Attachment | null>(null)
  const list = useRef<HTMLOListElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const inputId = useId()

  // Keep the newest message in view.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [chat.messages.length])

  // A photo is taller once it has loaded; the newest one stays in view when the chat was at the bottom
  const keepAtBottom = useCallback(() => {
    const el = list.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 400) el.scrollTop = el.scrollHeight
  }, [])

  const show = (a: Attachment | null) => { current.current = a; setAttachment(a) }

  // Leaving the chat: the local photo address is let go, and a file that was never sent is deleted
  useEffect(() => () => {
    const a = current.current
    if (a?.preview) URL.revokeObjectURL(a.preview)
    if (a?.uploaded) deleteUpload(a.uploaded.id)
  }, [])

  function remove() {
    const a = current.current
    if (!a) return
    if (a.preview) URL.revokeObjectURL(a.preview)
    if (a.uploaded) deleteUpload(a.uploaded.id)
    show(null)
  }

  async function attach(file: File) {
    // The same rules as the server, so a wrong file is refused before it uploads.
    // A large JPG, PNG or WebP photo is made smaller first (lib/files.ts), so only GIFs and PDFs can be too large here.
    if (!CHAT_FILE_TYPES.includes(file.type)) { toast('Only photos (JPG, PNG, WebP, GIF) and PDF files can be sent'); return }
    if (/gif|pdf/.test(file.type) && file.size > CHAT_FILE_MAX) { toast(`The file is too large — at most ${formatSize(CHAT_FILE_MAX)}`); return }
    remove()
    const isImage = file.type.startsWith('image/')
    const a: Attachment = { name: file.name, isImage, preview: isImage ? URL.createObjectURL(file) : null, uploaded: null }
    show(a)
    field.current?.focus()
    try {
      const uploaded = await uploadFile(file, { kind: 'chat', trip: chat.code })
      if (current.current === a) show({ ...a, uploaded })
      else deleteUpload(uploaded.id)
    } catch (e) {
      toast((e as Error).message)
      if (current.current === a) { if (a.preview) URL.revokeObjectURL(a.preview); show(null) }
    }
  }

  // A photo copied to the clipboard (a screenshot, for example) is attached when pasted into the field
  function paste(e: ClipboardEvent) {
    const file = e.clipboardData.files[0]
    if (file) { e.preventDefault(); attach(file) }
  }

  const uploading = !!attachment && !attachment.uploaded

  function submit(e: FormEvent) {
    e.preventDefault()
    if (uploading) return
    // Keep the text and the file when they could not be sent yet (the trip is still opening)
    if (chat.send(text, attachment?.uploaded?.id)) {
      setText('')
      if (attachment?.preview) URL.revokeObjectURL(attachment.preview)
      show(null)
    }
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
            <Message key={m._id ?? i} message={m} mine={!m.system && m.userId === user?._id} inWindow={inWindow} stays={stays} photo={members?.find(x => x.userId === m.userId)?.photo} onPhotoLoad={keepAtBottom} />
          ))}
        </ol>

        <p aria-live="polite" className="min-h-6 px-4 pb-2 pl-13 text-caption text-muted">
          {chat.typing.length > 0 && `${chat.typing.join(', ')} ${chat.typing.length === 1 ? 'is' : 'are'} typing…`}
        </p>
      </div>

      {attachment && (
        <div className="flex items-center gap-3 border-t border-line bg-white px-3 pt-2.5">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-[10px] bg-canvas">
            {attachment.preview
              ? <img src={attachment.preview} alt="" className="size-full object-cover" />
              : <span className="flex size-full items-center justify-center text-subtle"><FileIcon /></span>}
            {uploading && <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-white/50" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-roche">{attachment.name}</span>
            <span aria-live="polite" className="text-xs text-muted">
              {uploading ? 'Uploading…' : attachment.uploaded && `${attachment.isImage ? 'Photo' : 'PDF'} · ${formatSize(attachment.uploaded.size)}`}
            </span>
          </div>
          <button type="button" onClick={remove} aria-label="Remove the file" className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-roche">
            <CloseIcon />
          </button>
        </div>
      )}

      <form onSubmit={submit} className={cn('flex items-center gap-1.5 bg-white px-3 py-2.5', !attachment && 'border-t border-line')}>
        <input
          ref={picker}
          type="file"
          accept={CHAT_FILE_TYPES.join(',')}
          tabIndex={-1}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) attach(f) }}
        />
        <button
          type="button"
          aria-label="Add a photo or PDF"
          onClick={() => picker.current?.click()}
          disabled={!chat.ready}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-roche disabled:opacity-50',
            inWindow ? 'size-10' : 'size-11',
          )}
        >
          <AttachIcon />
        </button>
        <label htmlFor={inputId} className="sr-only">Message</label>
        {/* 16px text on phones, so iOS does not zoom in when the field gets focus. */}
        <input
          ref={field}
          id={inputId}
          type="text"
          autoComplete="off"
          placeholder={attachment ? 'Add a message…' : 'Message the group…'}
          maxLength={MESSAGE_MAX}
          value={text}
          onChange={e => { setText(e.target.value); chat.notifyTyping() }}
          onPaste={paste}
          className={cn(
            'min-w-0 flex-1 rounded-full border border-line-strong bg-canvas px-3.5 text-base text-roche placeholder:text-faint lg:text-sm',
            'focus:border-sommet focus:outline-none focus:ring-1 focus:ring-sommet',
            inWindow ? 'py-2.75' : 'py-3',
          )}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!chat.ready || uploading || (!text.trim() && !attachment)}
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

// The text of a message with its links clickable. Links open in a new tab, so the trip stays open.
const LINK = /(https?:\/\/[^\s<>"']+)/gi
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(LINK).map((part, i) =>
        i % 2 === 1
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-current underline underline-offset-2 hover:text-current">{part}</a>
          : part,
      )}
    </>
  )
}

// The card under a message with a link, filled in by the server a moment after sending ('msg:preview').
// A link from a booking site, or with a price, can go to the Stays tab with one tap.
function LinkCard({ preview: p, stays, inWindow }: { preview: LinkPreview; stays?: TripStays; inWindow?: boolean }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const name = p.title ?? platformName(p)
  const details = [p.location, p.price && formatPrice(p.price)].filter(Boolean).join(' · ')
  const saved = !!stays?.stays.some(s => s.url === p.url)
  const canSave = !!stays && (p.platform !== 'other' || !!p.price)

  async function save() {
    if (!stays || busy) return
    setBusy(true)
    const problem = await stays.add(p.url, null)
    setBusy(false)
    toast(problem ?? 'Saved to Stays')
  }

  const photos = p.images?.length ? p.images : p.image ? [p.image] : []
  const saveButton = canSave && (
    <button
      type="button"
      onClick={save}
      disabled={saved || busy || !stays.loaded}
      className={cn(
        'min-h-9 self-start rounded-[10px] px-3 text-sm font-bold',
        photos.length
          ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 disabled:opacity-80'
          : 'px-0 text-sommet hover:text-sommet-dark disabled:text-muted',
      )}
    >
      {saved ? 'In Stays ✓' : busy ? 'Saving…' : '+ Add to Stays'}
    </button>
  )

  // With photos: the same look as the stay cards in the Stays tab, only smaller
  if (photos.length) {
    return (
      <article className="relative isolate flex h-64 w-64 max-w-full flex-col justify-end overflow-hidden rounded-xl bg-roche shadow-card">
        <PhotoCarousel images={photos} credits={p.imageCredits} label={name} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/85 via-black/45 to-transparent" />
        <div className="relative flex flex-col gap-2 p-3 text-white">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-0.5 text-white hover:text-white">
            {p.title && <span className="text-2xs font-bold tracking-wider text-white/80 uppercase">{platformName(p)}</span>}
            <span className="line-clamp-2 text-sm font-bold wrap-anywhere hover:underline">{name}</span>
            {details && <span className="text-xs text-white/85">{details}</span>}
          </a>
          {p.cityCredit === 'osm' && <OsmCredit className="-mt-1 text-white/70" />}
          {saveButton}
        </div>
      </article>
    )
  }

  return (
    <div className={cn('w-64 max-w-full overflow-hidden rounded-xl bg-white', inWindow ? 'border border-line' : 'shadow-card')}>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block hover:bg-canvas">
        <div className="flex flex-col gap-0.5 px-3 py-2.5">
          {p.title && <span className="text-2xs font-bold tracking-wider text-muted uppercase">{platformName(p)}</span>}
          <span className="text-sm font-bold wrap-anywhere text-roche">{name}</span>
          {details && <span className="text-xs text-muted">{details}</span>}
        </div>
      </a>
      {p.cityCredit === 'osm' && <OsmCredit className="block px-3 pb-2 text-muted" />}
      {saveButton && <div className="border-t border-line px-3 py-1">{saveButton}</div>}
    </div>
  )
}

// A photo or PDF sent in the chat. A photo shows in the chat and opens full size in a new tab;
// a PDF is a small card that downloads it (the server sends PDFs as downloads).
function Attached({ file: f, inWindow, onPhotoLoad }: { file: ChatFile; inWindow?: boolean; onPhotoLoad?: () => void }) {
  const src = fileSrc(f.url)
  if (f.type.startsWith('image/')) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open the photo ${f.name}`} className="block overflow-hidden rounded-xl">
        <img src={src} alt={f.name} loading="lazy" onLoad={onPhotoLoad} className="block max-h-80 w-64 max-w-full bg-line object-cover" />
      </a>
    )
  }
  return (
    <a
      href={src}
      download={f.name}
      className={cn('flex w-64 max-w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 hover:bg-canvas', inWindow ? 'border border-line' : 'shadow-card')}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-canvas text-subtle"><FileIcon /></span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold text-roche">{f.name}</span>
        <span className="text-xs text-muted">PDF · {formatSize(f.size)}</span>
      </span>
    </a>
  )
}

function Message({ message: m, mine, inWindow, stays, photo, onPhotoLoad }: { message: ChatMessage; mine: boolean; inWindow?: boolean; stays?: TripStays; photo?: string | null; onPhotoLoad?: () => void }) {
  // From the server itself, e.g. "Group created" or "Mia left the group".
  if (m.system) {
    return (
      <li className="self-center rounded-full bg-line px-3 py-1.5 text-center text-xs font-semibold text-subtle">{m.text}</li>
    )
  }

  // wrap-anywhere also breaks a long word or link without spaces, which break-words leaves sticking out of the bubble
  const text = cn('max-w-full wrap-anywhere whitespace-pre-wrap px-3 py-2.5 leading-snug', inWindow ? 'text-sm' : 'text-md')
  const meta = <span className="text-xs font-bold text-muted">{mine ? 'You' : m.username} · {m.time}</span>
  const card = m.preview && <LinkCard preview={m.preview} stays={stays} inWindow={inWindow} />
  const file = m.file && <Attached file={m.file} inWindow={inWindow} onPhotoLoad={onPhotoLoad} />

  // Your own messages on the right, with your avatar beside them as the others have theirs.
  // The avatar shows the profile photo when the person has one.
  if (mine) {
    return (
      <li className="flex max-w-[85%] items-end gap-2 self-end">
        <div className="flex min-w-0 flex-col items-end gap-1">
          {meta}
          {file}
          {m.text && <p className={cn(text, 'rounded-lg rounded-br-[4px] bg-sommet text-white')}><Linked text={m.text} /></p>}
          {card}
        </div>
        <Avatar name={m.username ?? '?'} color={m.color ?? '#5b6676'} photo={photo} size="sm" />
      </li>
    )
  }

  return (
    <li className="flex max-w-[85%] items-end gap-2">
      <Avatar name={m.username ?? '?'} color={m.color ?? '#5b6676'} photo={photo} size="sm" />
      <div className="flex min-w-0 flex-col gap-1">
        {meta}
        {file}
        {m.text && <p className={cn(text, 'rounded-lg rounded-bl-[4px] bg-white', inWindow && 'border border-line')}><Linked text={m.text} /></p>}
        {card}
      </div>
    </li>
  )
}
