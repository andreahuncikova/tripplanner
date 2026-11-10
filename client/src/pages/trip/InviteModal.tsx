import { Link } from 'react-router-dom'
import type { TripSummary } from '@shared/types'
import { Button, Modal, useToast } from '../../components/ui'

export interface InviteModalProps {
  open: boolean
  onClose: () => void
  trip: Pick<TripSummary, 'name' | 'inviteCode'>
  // Off on the Trip settings screen itself
  settingsLink?: boolean
}

// "Invite friends" from the mockups: only the code and the link. Members, leaving and deleting were behind
// this button in the old app and are now in Trip settings.
export default function InviteModal({ open, onClose, trip, settingsLink = true }: InviteModalProps) {
  const toast = useToast()
  // The address of "Join a trip"; someone who is not logged in comes back to it after logging in
  const link = `${window.location.origin}/join?code=${trip.inviteCode}`
  // Phones (and Safari) can hand the link to WhatsApp, Messenger and so on; other browsers only copy it
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copied')
    } catch {
      toast('Could not copy the link. Select it and copy it yourself.', { tone: 'error' })
    }
  }

  async function share() {
    try {
      await navigator.share({ title: trip.name, text: `Join "${trip.name}" on TripPlanner`, url: link })
    } catch {
      // The person closed the share sheet; nothing to do
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite friends" description={`Anyone with the link can join ${trip.name}.`}>
      <div className="flex flex-col items-center gap-1.5 rounded-lg bg-canvas p-5">
        <span className="text-caption font-bold tracking-widest text-muted uppercase">Trip code</span>
        <span className="font-mono text-[30px] font-extrabold tracking-[0.16em] md:text-[34px]">{trip.inviteCode}</span>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="invite-link" className="sr-only">Invite link</label>
        <input
          id="invite-link"
          type="text"
          readOnly
          value={link}
          onFocus={e => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-white p-3.5 text-md text-subtle focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none"
        />
        <Button variant="soft" onClick={copy}>Copy link</Button>
      </div>

      {canShare && (
        <Button size="lg" fullWidth onClick={share} className="rounded-[14px]">
          <ShareIcon />Share invite
        </Button>
      )}

      {settingsLink && (
        <p className="text-center text-sm text-muted md:text-left">
          Members, leaving and deleting the trip are in{' '}
          <Link to={`/trips/${trip.inviteCode}/settings`} onClick={onClose} className="font-bold">Trip settings</Link>.
        </p>
      )}
    </Modal>
  )
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  )
}
