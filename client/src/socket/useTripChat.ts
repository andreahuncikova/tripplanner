import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, LinkPreview, OnlineUser } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { useSocket } from './useSocket'

// How long "… is typing" stays without a new typing event from that person,
// and how often we tell the others that we are still typing.
const TYPING_SHOWN_MS = 3000
const TYPING_SEND_MS = 2000

export interface TripChat {
  messages: ChatMessage[]
  // Everyone with the trip open right now, you included.
  online: OnlineUser[]
  // Names of the others who are typing right now.
  typing: string[]
  // True once the server has opened this trip on our socket. Before that (and after a lost connection,
  // until the trip is joined again) the server would drop a message, so the chat does not send yet.
  ready: boolean
  // Returns false when nothing was sent, so the text can stay in the field
  send: (text: string) => boolean
  // Call on every change in the message field; it only sends now and then.
  notifyTyping: () => void
}

// The chat of the trip that useJoinTrip() opened. Kept in TripLayout, so the messages stay
// while the desktop chat window is closed or the phone user is on another tab.
export function useTripChat(code: string): TripChat {
  const { socket } = useSocket()
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [online, setOnline] = useState<OnlineUser[]>([])
  const [typing, setTyping] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const lastTypingSent = useRef(0)
  const myName = user?.username

  useEffect(() => {
    if (!socket) return
    const timers = typingTimers.current

    // Nothing from the previous trip may show while this one loads.
    setMessages([])
    setOnline([])
    setTyping([])
    setReady(false)

    const stopTyping = (name: string) => {
      clearTimeout(timers.get(name))
      timers.delete(name)
      setTyping(names => names.filter(n => n !== name))
    }

    // Also after a reconnect: the last 60 messages replace what we had, so none is missing or shown twice.
    const onJoined = (data: { messages: ChatMessage[]; online: OnlineUser[] }) => {
      setMessages(data.messages)
      setOnline(data.online)
      setReady(true)
    }
    // The card for a link arrives a moment after its message
    const onPreview = ({ id, preview }: { id: string; preview: LinkPreview }) => {
      setMessages(list => list.map(m => (m._id === id ? { ...m, preview } : m)))
    }
    const onDisconnect = () => setReady(false)
    const onMsg = (msg: ChatMessage) => {
      setMessages(list => [...list, msg])
      // Their message arrived, so they have stopped typing it.
      if (msg.username) stopTyping(msg.username)
    }
    const onTyping = (name: string) => {
      // The same person in another tab of ours is not "someone typing".
      if (name === myName) return
      clearTimeout(timers.get(name))
      timers.set(name, setTimeout(() => stopTyping(name), TYPING_SHOWN_MS))
      setTyping(names => (names.includes(name) ? names : [...names, name]))
    }

    socket.on('joined', onJoined)
    socket.on('msg', onMsg)
    socket.on('online', setOnline)
    socket.on('typing', onTyping)
    socket.on('disconnect', onDisconnect)
    socket.on('msg:preview', onPreview)
    return () => {
      socket.off('disconnect', onDisconnect)
      socket.off('msg:preview', onPreview)
      socket.off('joined', onJoined)
      socket.off('msg', onMsg)
      socket.off('online', setOnline)
      socket.off('typing', onTyping)
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [socket, code, myName])

  const send = useCallback((text: string) => {
    const message = text.trim()
    if (!socket || !message || !ready) return false
    socket.emit('msg', message)
    // The next keystroke starts a new message, so it may tell the others straight away.
    lastTypingSent.current = 0
    return true
  }, [socket, ready])

  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (!socket || now - lastTypingSent.current < TYPING_SEND_MS) return
    lastTypingSent.current = now
    socket.emit('typing')
  }, [socket])

  return { messages, online, typing, ready, send, notifyTyping }
}
