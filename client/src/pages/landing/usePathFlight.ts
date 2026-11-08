import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'

// Moves the timeline's path. First the path draws itself from left to right with a small plane flying at the tip
// of the line (only this once, when the page opens); then, whenever the walkthrough moves on, the solid part of the
// path fills up to the new stop.
// Everything is in percent of the timeline, like the path itself (its viewBox is 0 to 100 and is stretched to fit).

type Point = { x: number; y: number }
type Parts = {
  box: RefObject<HTMLOListElement | null>
  path: RefObject<SVGPathElement | null>
  plane: RefObject<HTMLDivElement | null>
  points: RefObject<Point[]>
  pilot: RefObject<number>
}

const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
// The inverse of ease: how far through the flight (0 to 1) it is when the plane has covered the share v of the way.
const unease = (v: number) => (v < 0.5 ? Math.cbrt(v / 4) : 1 - Math.cbrt(2 * (1 - v)) / 2)

// The first draw: from just left of the timeline to just right of it, in this many milliseconds.
const DRAW = { from: -1, to: 101, ms: 2200 }
// When the plane passes x during the first draw, in seconds, so a stop and its name appear right as it flies over.
export const arrival = (x: number) => (unease((x - DRAW.from) / (DRAW.to - DRAW.from)) * DRAW.ms) / 1000

const clip = (x: number) => `inset(-20% ${100 - x}% -20% -5%)`

// Puts the plane on the path at x, turned the way the path goes there.
function place({ box, path, plane, points }: Parts, at: number) {
  const el = plane.current, ol = box.current
  if (!el || !ol) return
  if (!points.current.length && path.current) {
    const p = path.current, length = p.getTotalLength()
    points.current = Array.from({ length: 241 }, (_, i) => p.getPointAtLength((length * i) / 240))
  }
  const pts = points.current
  const i = Math.min(Math.max(pts.findIndex(p => p.x >= at), 1), pts.length - 1)
  const a = pts[i - 1], b = pts[i]
  const y = a.y + ((b.y - a.y) * (at - a.x)) / (b.x - a.x || 1)
  // The path is stretched, so the angle is taken in pixels, not in the viewBox's units.
  const angle = (Math.atan2((b.y - a.y) * ol.offsetHeight, (b.x - a.x) * ol.offsetWidth) * 180) / Math.PI
  el.style.left = `${at}%`
  el.style.top = `${y}%`
  el.style.rotate = `${angle}deg`
}

// Runs a flight from one x to another (with the plane, or without it) and returns a function that stops it.
function fly(parts: Parts, from: number, to: number, ms: number, frame: (at: number) => void, withPlane = true) {
  const { plane, pilot } = parts
  const id = withPlane ? ++pilot.current : -1
  const start = performance.now()
  let raf = 0
  const tick = (now: number) => {
    const t = Math.min((now - start) / ms, 1)
    const at = from + (to - from) * ease(t)
    frame(at)
    if (pilot.current === id) {
      place(parts, at)
      if (plane.current) plane.current.style.opacity = t < 1 ? '1' : '0'
    }
    if (t < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

export function usePathFlight(x: number) {
  const box = useRef<HTMLOListElement>(null)
  const path = useRef<SVGPathElement>(null)
  const reveal = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const plane = useRef<HTMLDivElement>(null)
  const points = useRef<Point[]>([])
  // The stop the path is filled to, and how far it is filled right now (between the two during a flight).
  const target = useRef(x)
  const filled = useRef(x)
  // Which flight moves the plane (only the first draw does; the steps fill the path without it).
  const pilot = useRef(0)

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  // The first draw, before the page is painted so the full path never flashes.
  useLayoutEffect(() => {
    if (fill.current) fill.current.style.clipPath = clip(filled.current)
    if (!reveal.current) return
    if (reduced()) return
    reveal.current.style.clipPath = clip(DRAW.from)
    return fly({ box, path, plane, points, pilot }, DRAW.from, DRAW.to, DRAW.ms, at => { if (reveal.current) reveal.current.style.clipPath = clip(at) })
  }, [])

  // The walkthrough moved on: fill the path up to the new stop.
  useEffect(() => {
    if (target.current === x) return
    const from = filled.current
    target.current = x
    const setFill = (at: number) => {
      filled.current = at
      if (fill.current) fill.current.style.clipPath = clip(at)
    }
    if (reduced()) return setFill(x)
    return fly({ box, path, plane, points, pilot }, from, x, 700, setFill, false)
  }, [x])

  return { box, path, reveal, fill, plane }
}
