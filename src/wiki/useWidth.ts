import { useEffect, useRef, useState } from 'react'

/** Measured width of an element, for SVG that has to lay itself out. */
export function useWidth<T extends HTMLElement>(initial = 680, floor = 280) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(floor, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [floor])
  return [ref, width] as const
}
