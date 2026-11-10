import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { imageSrc } from './stayFormat'

// The photos of a stay, filling their box, one at a time. Arrows and dots move between them,
// a swipe does too on phones. A photo from Google Maps carries its credit in the corner, as Google asks.
export default function PhotoCarousel({ images, credits, label }: { images: string[]; credits?: string[]; label: string }) {
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const count = images.length
  const i = Math.min(index, count - 1)
  const go = (to: number) => setIndex((to + count) % count)

  return (
    <div
      className="absolute inset-0"
      role="group"
      aria-roledescription="photos"
      aria-label={`${label}, photo ${i + 1} of ${count}`}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current == null || count < 2) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1)
      }}
    >
      <img
        key={images[i]}
        src={imageSrc(images[i])}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
      />

      {credits?.[i] && (
        <span className="absolute top-2 right-2 max-w-[70%] truncate rounded bg-roche/70 px-1.5 py-0.5 text-2xs text-white">
          {credits[i]}
        </span>
      )}

      {count > 1 && (
        <>
          <ArrowButton side="left" label="Previous photo" onClick={() => go(i - 1)} />
          <ArrowButton side="right" label="Next photo" onClick={() => go(i + 1)} />
          <div className="absolute inset-x-0 top-[42%] flex justify-center gap-1.5" aria-hidden="true">
            {images.map((_, n) => (
              <span key={n} className={cn('size-1.5 rounded-full', n === i ? 'bg-white' : 'bg-white/50')} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ArrowButton({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'absolute top-[22%] flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-roche shadow-raised hover:bg-white',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}
