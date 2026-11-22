import { cn } from '../../lib/cn'

// City names found on OpenStreetMap (server/src/preview/osm.ts) may be used when OpenStreetMap is credited,
// with a link to its copyright page. Shown under the stays and on chat link cards that use such a city.
export default function OsmCredit({ className }: { className?: string }) {
  return (
    <span className={cn('text-xs', className)}>
      City:{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
        © OpenStreetMap contributors
      </a>
    </span>
  )
}
