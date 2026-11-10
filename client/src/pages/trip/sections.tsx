import ChatPanel from './ChatPanel'
import StaysView from './StaysSection'
import { useTripOutlet } from './tripOutlet'

// The trip's sections. Each one is a placeholder until its feature is built.
function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="text-muted">{text}</p>
    </section>
  )
}

export const PlanSection = () => <Placeholder title="Plan" text="Destination, dates and votes." />
export function StaysSection() {
  const { stays, trip } = useTripOutlet()
  return <StaysView stays={stays} trip={trip} />
}
export const ItinerarySection = () => <Placeholder title="Itinerary" text="What happens on each day." />
export const BudgetSection = () => <Placeholder title="Budget" text="Expenses and who owes whom." />

// On phones the chat is its own tab and fills the screen. Desktop opens it from the bubble instead,
// but someone who widens the window on this tab still sees it in a card.
export function ChatSection() {
  const { chat } = useTripOutlet()
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:h-150 lg:overflow-hidden lg:rounded-xl lg:border lg:border-line">
      <ChatPanel chat={chat} />
    </div>
  )
}
