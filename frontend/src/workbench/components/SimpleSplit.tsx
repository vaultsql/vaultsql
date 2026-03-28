import {
  Children,
  type PropsWithChildren,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type SplitDirection = 'horizontal' | 'vertical'

type SplitProps = PropsWithChildren<{
  direction?: SplitDirection
  initialSizes?: [number, number]
  minSizes?: [number, number]
  gutterSize?: number
  className?: string
}>

const DEFAULT_MIN_SIZES: [number, number] = [10, 10]

export function SimpleSplit({
  children,
  direction = 'horizontal',
  initialSizes = [60, 40],
  minSizes = DEFAULT_MIN_SIZES,
  gutterSize = 3,
  className = '',
}: SplitProps) {
  const normalizedInitial = useMemo(() => normalizeSizes(initialSizes), [initialSizes])
  const containerRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef(0)
  const startSizesRef = useRef<[number, number]>(normalizedInitial)
  const [sizes, setSizes] = useState<[number, number]>(() => normalizedInitial)

  const childArray = useMemo(() => {
    const arr = Children.toArray(children)
    if (arr.length !== 2) {
      throw new Error('SimpleSplit expects exactly two children')
    }
    return arr as [ReactNode, ReactNode]
  }, [children])

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!containerRef.current) return
      const containerSize =
        direction === 'horizontal'
          ? containerRef.current.offsetWidth
          : containerRef.current.offsetHeight

      if (!containerSize) return

      const currentPos = direction === 'horizontal' ? event.clientX : event.clientY
      const delta = currentPos - startPosRef.current
      const deltaPercent = (delta / containerSize) * 100

      const minFirst = minSizes[0]
      const minSecond = minSizes[1]
      const maxFirst = 100 - minSecond
      let nextFirst = startSizesRef.current[0] + deltaPercent
      nextFirst = Math.max(minFirst, Math.min(maxFirst, nextFirst))

      setSizes([nextFirst, 100 - nextFirst])
    },
    [direction, minSizes],
  )

  const handlePointerUp = useCallback(
    function onPointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    },
    [handlePointerMove],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      startPosRef.current = direction === 'horizontal' ? event.clientX : event.clientY
      startSizesRef.current = sizes

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [direction, handlePointerMove, handlePointerUp, sizes],
  )

  useEffect(() => {
    setSizes(normalizedInitial)
    startSizesRef.current = normalizedInitial
  }, [normalizedInitial])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  const gutterStyle =
    direction === 'horizontal'
      ? { width: gutterSize }
      : {
          height: gutterSize,
        }

  const containerClasses = [
    'flex',
    'h-full',
    'w-full',
    direction === 'vertical' ? 'flex-col' : 'flex-row',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const paneClass = 'flex min-h-0 min-w-0 flex-shrink-0 flex-grow-0 flex-col overflow-hidden'
  const gutterClass = [
    'flex-shrink-0',
    'bg-background',
    'relative',
    'hover:bg-indigo-500/50',
    'transition-colors',
    'delay-75',
    'z-50', // Ensure above other content
    direction === 'vertical' ? 'cursor-row-resize' : 'cursor-col-resize',
  ].join(' ')

  return (
    <div ref={containerRef} className={containerClasses}>
      <div className={paneClass} style={{ flexBasis: `${sizes[0]}%` }}>
        {childArray[0]}
      </div>
      <div
        className={gutterClass}
        style={gutterStyle}
        role="separator"
        aria-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
        onPointerDown={handlePointerDown}
      />
      <div className={paneClass} style={{ flexBasis: `${sizes[1]}%` }}>
        {childArray[1]}
      </div>
    </div>
  )
}

function normalizeSizes([first, second]: [number, number]): [number, number] {
  const total = first + second
  if (total === 0) {
    return [50, 50]
  }

  return [(first / total) * 100, (second / total) * 100]
}
