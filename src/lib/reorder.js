/**
 * Index arithmetic for drag-to-reorder, kept out of the component so it can be
 * reasoned about without a pointer in the picture.
 */

export function moveItem(list, from, to) {
  if (from === to) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Where a dragged row would land, from every row's original vertical centre and
 * where the dragged one's centre has been moved to. Measured against the
 * positions the rows started at, so the answer doesn't chase its own tail as
 * rows shift out of the way.
 */
export function targetIndexForCenter(centers, draggedIndex, draggedCenter) {
  let target = draggedIndex
  for (let i = 0; i < centers.length; i += 1) {
    if (i === draggedIndex) continue
    if (i < draggedIndex && draggedCenter < centers[i]) target = Math.min(target, i)
    if (i > draggedIndex && draggedCenter > centers[i]) target = Math.max(target, i)
  }
  return target
}

/** Where a row ends up if the drag is dropped right now. */
export function projectedIndex(index, draggedIndex, targetIndex) {
  if (index === draggedIndex) return targetIndex
  if (draggedIndex < index && index <= targetIndex) return index - 1
  if (targetIndex <= index && index < draggedIndex) return index + 1
  return index
}

/** How far a row slides to open a gap where the dragged one would drop. The
 * dragged row itself follows the pointer instead, so it doesn't slide. */
export function shiftForIndex(index, draggedIndex, targetIndex, step) {
  if (index === draggedIndex) return 0
  return (projectedIndex(index, draggedIndex, targetIndex) - index) * step
}
