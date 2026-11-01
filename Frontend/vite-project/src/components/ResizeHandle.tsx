import { useRef } from 'react'
import { cn } from './ui/cn'

type Props = {
  // Which edge of the panel the handle sits on. "left" = the panel grows when
  // dragged left (artifact panel); "right" = grows when dragged right (sidebar)
  side: 'left' | 'right'
  width: number
  min: number
  max: number
  // Releasing below this width collapses the panel
  collapseAt: number
  // Width to restore after a collapse, so it reopens at a normal size
  defaultWidth: number
  onResize: (width: number) => void
  onCollapse: () => void
  // Lets the panel react while dragging (dim near collapse, cover iframes...)
  onDraggingChange?: (dragging: boolean) => void
  dragging: boolean
}

// Thin draggable strip on a panel's edge. Place it inside a `relative` parent.
function ResizeHandle({
  side, width, min, max, collapseAt, defaultWidth, onResize, onCollapse, onDraggingChange, dragging,
}: Props) {
  // Where the drag started: pointer x and panel width at that moment
  const dragStart = useRef<{ x: number; width: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Stop the browser from selecting text while dragging, and keep receiving
    // move events even when the pointer leaves the handle
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, width }
    onDraggingChange?.(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const moved = e.clientX - dragStart.current.x
    const next = dragStart.current.width + (side === 'right' ? moved : -moved)
    // Allow going below `min` while dragging so the user can see it closing
    onResize(Math.max(collapseAt - 40, Math.min(next, max)))
  }

  const onPointerUp = () => {
    if (!dragStart.current) return
    dragStart.current = null
    onDraggingChange?.(false)
    if (width < collapseAt) {
      onCollapse()
      onResize(defaultWidth)
    } else if (width < min) {
      onResize(min)
    }
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title='Drag to resize'
      className={cn('group absolute top-0 z-20 h-full w-2 cursor-col-resize', side === 'left' ? '-left-1' : '-right-1')}
    >
      <div
        className={cn(
          'mx-auto h-full w-0.5 transition-colors',
          dragging ? 'bg-indigo-400' : 'bg-transparent group-hover:bg-indigo-400/60',
        )}
      />
    </div>
  )
}

export default ResizeHandle
