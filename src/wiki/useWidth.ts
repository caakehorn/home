import { useCallback, useRef, useState } from 'react'

/**
 * Measured width of an element, for SVG that has to lay itself out.
 *
 * A callback ref rather than a ref object on purpose: an element that only
 * appears after its data loads would never be seen by an effect that ran once
 * on mount, and the chart would render itself against the placeholder width
 * for the life of the page.
 */
export function useWidth<T extends HTMLElement>(initial = 680, floor = 280) {
  const [width, setWidth] = useState(initial)
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback(
    (node: T | null) => {
      observer.current?.disconnect()
      observer.current = null
      if (!node) return
      setWidth(Math.max(floor, node.getBoundingClientRect().width))
      const ro = new ResizeObserver(([entry]) => setWidth(Math.max(floor, entry.contentRect.width)))
      ro.observe(node)
      observer.current = ro
    },
    [floor],
  )

  return [ref, width] as const
}
