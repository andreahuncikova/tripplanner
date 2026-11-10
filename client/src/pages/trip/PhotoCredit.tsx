// The credit Google asks for on a photo from Google Maps, in the corner of the photo
export default function PhotoCredit({ credit }: { credit?: string }) {
  if (!credit) return null
  return (
    <span className="absolute right-1.5 bottom-1.5 max-w-[90%] truncate rounded bg-roche/70 px-1.5 py-0.5 text-2xs text-white">
      {credit}
    </span>
  )
}
