import ChatPanel from './ChatPanel'

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
export const StaysSection = () => <Placeholder title="Stays" text="Saved stays, grouped into areas." />
export const ItinerarySection = () => <Placeholder title="Itinerary" text="What happens on each day." />
export const BudgetSection = () => <Placeholder title="Budget" text="Expenses and who owes whom." />

// On phones the chat is its own tab and fills the screen.
export const ChatSection = () => (
  <div className="-mx-5 -my-4 flex min-h-[60dvh] flex-col bg-white lg:mx-0 lg:my-0 lg:rounded-xl">
    <ChatPanel />
  </div>
)
