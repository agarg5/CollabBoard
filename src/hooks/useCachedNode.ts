import { useEffect, useRef } from 'react'
import type Konva from 'konva'

export function useCachedNode(
  shouldCache: boolean,
  cacheKey: string,
  offset: number = 4,
): React.RefObject<Konva.Group | null> {
  const ref = useRef<Konva.Group>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (shouldCache) {
      try {
        node.cache({ offset })
      } catch {
        // cache can fail if node has zero dimensions
      }
    } else {
      node.clearCache()
    }
  }, [shouldCache, cacheKey, offset])

  return ref
}
