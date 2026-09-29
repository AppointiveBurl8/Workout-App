import { useRef, useState } from 'react'
import { moveItem, projectedIndex, shiftForIndex, targetIndexForCenter } from '../lib/reorder'
import ExerciseListItem from './ExerciseListItem'

/**
 * Drag-to-reorder over pointer events rather than a library: HTML5 drag-and-drop
 * doesn't fire on touch at all, and this is a phone-first list. The handle keeps
 * pointer capture for the whole drag, so a finger that strays off the row still
 * steers it.
 */
export default function ReorderableExerciseList({ ids, exercisesById, onChange, showCategory = false }) {
  const [drag, setDrag] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const itemRefs = useRef([])
  const handleRefs = useRef([])

  const nameAt = (index) => exercisesById.get(ids[index])?.name ?? 'Unknown exercise'

  const announceMove = (index, target) =>
    setAnnouncement(`${nameAt(index)} moved to position ${target + 1} of ${ids.length}`)

  const beginDrag = (index) => (event) => {
    if (drag || event.button > 0) return
    const rows = itemRefs.current.slice(0, ids.length).map((el) => el?.getBoundingClientRect())
    if (rows.some((rect) => !rect)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      index,
      targetIndex: index,
      centers: rows.map((rect) => rect.top + rect.height / 2),
      // Row pitch, not row height: the gap between rows counts toward how far a
      // row has to slide to open a space.
      step: rows.length > 1 ? Math.abs(rows[1].top - rows[0].top) : rows[0].height,
      startY: event.clientY,
      deltaY: 0,
    })
  }

  const onPointerMove = (event) => {
    if (!drag) return
    const deltaY = event.clientY - drag.startY
    setDrag({
      ...drag,
      deltaY,
      targetIndex: targetIndexForCenter(drag.centers, drag.index, drag.centers[drag.index] + deltaY),
    })
  }

  const endDrag = () => {
    if (!drag) return
    if (drag.targetIndex !== drag.index) {
      announceMove(drag.index, drag.targetIndex)
      onChange(moveItem(ids, drag.index, drag.targetIndex))
    }
    setDrag(null)
  }

  // Arrow keys on a focused handle do the same job without a pointer.
  const onHandleKeyDown = (index) => (event) => {
    const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!direction) return
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    event.preventDefault()
    announceMove(index, target)
    onChange(moveItem(ids, index, target))
    // Follow the row you're holding as it moves out from under the focus ring.
    requestAnimationFrame(() => handleRefs.current[target]?.focus())
  }

  const styleFor = (index) => {
    if (!drag) return undefined
    if (index === drag.index) {
      return { transform: `translateY(${drag.deltaY}px)`, position: 'relative', zIndex: 10 }
    }
    return {
      transform: `translateY(${shiftForIndex(index, drag.index, drag.targetIndex, drag.step)}px)`,
      transition: 'transform 120ms ease',
    }
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {ids.map((id, index) => (
          <ExerciseListItem
            key={`${id}-${index}`}
            exercise={exercisesById.get(id)}
            index={index}
            // Mid-drag, show where each row would land rather than where it is.
            position={drag ? projectedIndex(index, drag.index, drag.targetIndex) + 1 : index + 1}
            showCategory={showCategory}
            dragging={drag?.index === index}
            style={styleFor(index)}
            itemRef={(el) => {
              itemRefs.current[index] = el
            }}
            handleRef={(el) => {
              handleRefs.current[index] = el
            }}
            handleProps={{
              'aria-label': `Reorder ${nameAt(index)}, position ${index + 1} of ${ids.length}. Drag, or use the arrow keys.`,
              onPointerDown: beginDrag(index),
              onPointerMove,
              onPointerUp: endDrag,
              onPointerCancel: endDrag,
              onKeyDown: onHandleKeyDown(index),
            }}
            onRemove={() => onChange(ids.filter((_, i) => i !== index))}
          />
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  )
}
