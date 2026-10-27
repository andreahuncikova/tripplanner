import { useState, type ReactNode } from 'react'
import { Avatar, AvatarGroup, Button, Card, Input, Modal, Tabs, useToast } from '../components/ui'

const people = [
  { name: 'Mia', color: '#E86A4A' },
  { name: 'Jonas', color: '#3E7CB1' },
  { name: 'Sara', color: '#7A5BA6' },
  { name: 'Leo', color: '#2E8B57' },
  { name: 'Ema', color: '#8A96A6' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-caption font-bold tracking-widest text-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

// Every UI component in one place, to check them against the mockups (open /ui).
export default function UiGallery() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [section, setSection] = useState<'plan' | 'stays' | 'itinerary' | 'budget'>('plan')
  // /ui?modal opens the modal straight away, to look at it.
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).has('modal'))
  const toast = useToast()

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-12">
      <h1 className="font-display text-display font-extrabold tracking-tight">UI components</h1>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button>+ New trip</Button>
          <Button variant="secondary">Join with code</Button>
          <Button variant="soft">Invite</Button>
          <Button variant="dark">Add</Button>
          <Button variant="danger">Delete trip</Button>
          <Button variant="link">+ Add expense</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Pay</Button>
          <Button size="lg" pill>Log in</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Input">
        <Input label="Email" type="email" placeholder="mia@example.com" />
        <Input label="Password" type="password" hint="At least 8 characters." />
        <Input label="Amount" defaultValue="abc" error="Enter a number." />
      </Section>

      <Section title="Card">
        <Card className="flex flex-col gap-1">
          <strong className="text-lg">Bali with friends</strong>
          <span className="text-sm text-muted">12–22 Mar 2027 · 5 people</span>
        </Card>
        <Card selected className="flex flex-col gap-1">
          <strong>Jungle villa with pool</strong>
          <span className="text-caption text-muted">Ubud center · €58 / night</span>
        </Card>
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-3">
          <Avatar {...people[0]} size="sm" />
          <Avatar {...people[0]} />
          <Avatar {...people[0]} size="lg" />
          <AvatarGroup people={people} />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs
          label="Log in or sign up"
          value={tab}
          onChange={setTab}
          items={[{ value: 'login', label: 'Log in' }, { value: 'signup', label: 'Sign up' }]}
        />
        <Tabs
          label="Trip sections"
          variant="underline"
          value={section}
          onChange={setSection}
          items={[
            { value: 'plan', label: 'Plan' },
            { value: 'stays', label: 'Stays' },
            { value: 'itinerary', label: 'Itinerary' },
            { value: 'budget', label: 'Budget' },
          ]}
        />
      </Section>

      <Section title="Modal and Toast">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => toast('Link copied')}>Show toast</Button>
          <Button variant="secondary" onClick={() => toast('Could not save the expense', { tone: 'error' })}>Show error toast</Button>
        </div>
        <Modal open={open} onClose={() => setOpen(false)} title="Invite friends" description="Anyone with the link can join Bali with friends.">
          <Input label="Invite link" hideLabel readOnly value="tripplanner.app/join/A3BF92C1" />
          <Button size="lg" fullWidth onClick={() => { setOpen(false); toast('Link copied') }}>Share invite</Button>
        </Modal>
      </Section>
    </main>
  )
}
