import type { ReactNode } from 'react'

// What a tab shows before its first stay or expense: a short guide in a dashed box. The tab's icon, a title, one
// short line, and three numbered steps as small white cards with a few words each. On phones the steps are under each other.
export default function EmptyGuide({ icon, title, text, steps, label }: {
  icon: ReactNode; title: string; text: string; steps: { title: string; text: string }[]; label: string
}) {
  return (
    <section aria-label={label} className="flex flex-col items-center gap-6 rounded-xl border border-dashed border-line-strong px-5 py-8 text-center lg:py-10">
      <div className="flex flex-col items-center gap-3">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-ciel-light text-sommet [&_svg]:size-6.5">{icon}</span>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-extrabold">{title}</p>
          <p className="text-sm text-muted">{text}</p>
        </div>
      </div>
      <ol className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 rounded-lg bg-white p-3.5 text-left shadow-card sm:flex-col sm:items-start sm:gap-2">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chemin text-xs font-extrabold text-roche">{i + 1}</span>
            <span className="flex flex-col">
              <strong className="text-sm">{s.title}</strong>
              <span className="text-xs text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
