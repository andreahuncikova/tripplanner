import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'
import { shrinkPhoto, uploadFile } from '../lib/files'
import { Avatar, Button, Input, Modal, useToast } from '../components/ui'
import { BackIcon } from '../components/layout/icons'
import { EditForm, Row, Section } from './settingsParts'

type Dialog = 'name' | 'email' | 'password' | 'paypal'
// Profile photos are shown small, so a side of 512 px is plenty and keeps the file storage small
const PHOTO_SIDE = 512

// The user's own profile: photo, name, e-mail and password, laid out like Trip settings.
// A new e-mail only counts after its owner clicks the link sent to it (POST /api/auth/email).
export default function Profile() {
  const { user, updateSession, logout } = useAuth()
  const toast = useToast()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const close = () => setDialog(null)

  if (!user) return null

  // Name and photo: the answer has a new log-in token, because the token carries the name
  async function saveProfile(changes: { username?: string; photo?: string | null; paypalMe?: string | null }) {
    updateSession(await api<{ token: string; user: User }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(changes) }))
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError('')
    setPhotoBusy(true)
    try {
      const small = await shrinkPhoto(file, PHOTO_SIDE)
      const uploaded = await uploadFile(new File([small], file.name, { type: small.type }), { kind: 'avatar' })
      await saveProfile({ photo: uploaded.url })
      toast('Photo saved')
    } catch (err) {
      setPhotoError((err as Error).message)
    } finally {
      setPhotoBusy(false)
    }
  }

  async function removePhoto() {
    setPhotoError('')
    setPhotoBusy(true)
    try {
      await saveProfile({ photo: null })
      toast('Photo removed')
    } catch (err) {
      setPhotoError((err as Error).message)
    } finally {
      setPhotoBusy(false)
    }
  }

  async function cancelEmail() {
    updateSession(await api<{ user: User }>('/api/auth/email', { method: 'DELETE' }))
    toast('E-mail change cancelled')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:min-h-0 lg:flex-1 lg:gap-6 lg:px-12 lg:py-9 xl:px-16">
      <header className="flex items-center gap-1 bg-white px-3 pt-3 pb-3 lg:bg-transparent lg:p-0">
        <Link to="/dashboard" aria-label="Back to your trips" className="flex size-11 items-center justify-center text-roche hover:text-roche lg:hidden">
          <BackIcon />
        </Link>
        <h1 className="text-xl font-extrabold lg:text-heading">Profile</h1>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-6 py-5 lg:grid lg:flex-none lg:grid-cols-2 lg:items-start lg:gap-6 lg:p-0">
        {/* Desktop: You on the left; Account and Payment methods under each other on the right */}
        <Section title="You" className="lg:row-span-2">
          {/* The photo the others see next to your messages, votes and expenses */}
          <div className="flex items-center gap-4 border-b border-line px-4 py-4 lg:px-5">
            <Avatar name={user.username} color={user.color} photo={user.photo} size="xl" />
            <div className="flex flex-col items-start gap-2">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} className="sr-only" aria-label="Choose a profile photo" tabIndex={-1} />
              <Button variant="secondary" size="sm" disabled={photoBusy} onClick={() => fileInput.current?.click()}>
                {photoBusy ? 'Saving…' : user.photo ? 'Change photo' : 'Add a photo'}
              </Button>
              {user.photo && !photoBusy && <Button variant="link" size="sm" onClick={removePhoto} className="text-muted">Remove photo</Button>}
              {photoError && <p role="alert" className="text-sm font-semibold text-danger">{photoError}</p>}
            </div>
          </div>
          <Row label="Name" value={user.username} onEdit={() => setDialog('name')} />
        </Section>

        <Section title="Account" className="lg:col-start-2 lg:row-start-1">
          <Row label="E-mail" value={user.email} onEdit={() => setDialog('email')} />
          {user.pendingEmail && (
            <div role="status" className="flex flex-col gap-2.5 border-b border-line bg-chemin-light px-4 py-3.5 text-sm text-chemin-dark lg:px-5">
              <p>
                We sent a link to <strong>{user.pendingEmail}</strong>. Your e-mail changes when you open it;
                until then you log in with {user.email}.
              </p>
              <Button variant="secondary" size="sm" onClick={cancelEmail} className="self-start">Cancel the change</Button>
            </div>
          )}
          <Row label="Password" value="••••••••" onEdit={() => setDialog('password')} />
        </Section>

        {/* How the others pay you back when the trip is settled (the Pay button in the Budget) */}
        <Section title="Payment methods" className="lg:col-start-2 lg:row-start-2">
          <Row label="PayPal.Me" value={user.paypalMe ? `paypal.me/${user.paypalMe}` : 'Not added'} onEdit={() => setDialog('paypal')} />
          <p className="px-4 py-3.5 text-sm text-muted lg:px-5">
            {user.paypalMe
              ? <>Your friends in a trip see this link and can pay you back with one tap. <a href={`https://paypal.me/${user.paypalMe}`} target="_blank" rel="noopener noreferrer" className="font-semibold">Check that it works</a></>
              : 'Add your PayPal.Me link, so friends can pay you back with one tap when the trip is settled.'}
          </p>
        </Section>

        <div className="mt-6 flex flex-col gap-2.5 lg:col-start-1 lg:row-start-3 lg:mt-0 lg:flex-row lg:self-start">
          <Button variant="secondary" fullWidth onClick={logout} className="lg:w-auto">Log out</Button>
        </div>
      </div>

      {/* Each form is only rendered while it is open, so it starts empty or with the current value every time */}
      <Modal open={dialog === 'name'} onClose={close} title="Your name" description="Your friends see it in their trips.">
        {dialog === 'name' && (
          <EditForm onSave={async form => { await saveProfile({ username: String(form.get('username')) }); toast('Saved'); close() }}>
            <Input label="Your name" name="username" defaultValue={user.username} required maxLength={30} autoComplete="name" />
          </EditForm>
        )}
      </Modal>

      <Modal open={dialog === 'paypal'} onClose={close} title="PayPal.Me" description="Paste your PayPal.Me link. You find it in the PayPal app under your profile.">
        {dialog === 'paypal' && (
          <div className="flex flex-col gap-3">
            <EditForm onSave={async form => { await saveProfile({ paypalMe: String(form.get('paypalMe')) }); toast('Saved'); close() }}>
              <Input label="Your PayPal.Me link" name="paypalMe" defaultValue={user.paypalMe ? `paypal.me/${user.paypalMe}` : ''} required placeholder="paypal.me/yourname" autoComplete="off" />
            </EditForm>
            {user.paypalMe && (
              <Button variant="link" onClick={async () => { await saveProfile({ paypalMe: null }); toast('PayPal.Me link removed'); close() }} className="self-center text-muted">
                Remove the link
              </Button>
            )}
          </div>
        )}
      </Modal>

      <Modal open={dialog === 'email'} onClose={close} title="Change your e-mail" description="We send a link to the new address. Your e-mail changes when you open it.">
        {dialog === 'email' && (
          <EditForm onSave={async form => {
            updateSession(await api<{ user: User }>('/api/auth/email', {
              method: 'POST',
              body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
            }))
            toast('Link sent — check your e-mail')
            close()
          }}>
            <Input label="New e-mail" name="email" type="email" required autoComplete="email" />
            <Input label="Your password" name="password" type="password" required autoComplete="current-password" hint="So we know it is really you." />
          </EditForm>
        )}
      </Modal>

      <Modal open={dialog === 'password'} onClose={close} title="Change your password" description="Your other devices are logged out; this one stays logged in.">
        {dialog === 'password' && (
          <EditForm onSave={async form => {
            updateSession(await api<{ token: string; user: User }>('/api/auth/password', {
              method: 'POST',
              body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }),
            }))
            toast('Password changed')
            close()
          }}>
            <Input label="Current password" name="currentPassword" type="password" required autoComplete="current-password" />
            <Input label="New password" name="newPassword" type="password" required minLength={8} autoComplete="new-password" hint="At least 8 characters." />
          </EditForm>
        )}
      </Modal>
    </div>
  )
}
