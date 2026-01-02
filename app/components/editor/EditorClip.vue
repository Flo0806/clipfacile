<script setup lang="ts">
const props = defineProps<{
  clip: Clip
  mediaFile: MediaFile | undefined
  pixelsPerMs: number
  isSelected: boolean
  timelineElement: HTMLElement | null
  trackElement: HTMLElement | null
}>()

const emit = defineEmits<{
  select: [clipId: string]
  move: [clipId: string, newTimeMs: number, clientY: number]
  moveEnd: [clipId: string, newTimeMs: number, removed: boolean, clientY: number]
  resize: [clipId: string, edge: 'left' | 'right', newEdgeTimeMs: number]
  resizeEnd: [clipId: string, edge: 'left' | 'right', newEdgeTimeMs: number]
}>()

const { snapToMarker } = useEditorState()

// Drag state
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartTimeMs = ref(0)
const currentTimeMs = ref(props.clip.timelineStart)
const isSnapped = ref(false)
const isOutsideTimeline = ref(false)
const lastClientY = ref(0)

// Resize state
const isResizing = ref(false)
const resizeEdge = ref<'left' | 'right'>('right')
const resizeStartX = ref(0)
const resizeStartEdgeMs = ref(0)
const currentEdgeMs = ref(0)
const isResizeSnapped = ref(false)

// Keep currentTimeMs in sync when not dragging
watch(() => props.clip.timelineStart, (newTime) => {
  if (!isDragging.value && !isResizing.value) {
    currentTimeMs.value = newTime
  }
})

const clipStyle = computed(() => {
  let timeMs = props.clip.timelineStart
  let widthMs = props.clip.duration

  if (isDragging.value) {
    timeMs = currentTimeMs.value
  } else if (isResizing.value) {
    if (resizeEdge.value === 'left') {
      // Left edge moves, right edge stays
      const rightEdge = props.clip.timelineStart + props.clip.duration
      timeMs = Math.min(currentEdgeMs.value, rightEdge - 100) // min 100ms
      widthMs = rightEdge - timeMs
    } else {
      // Right edge moves, left edge stays
      widthMs = Math.max(100, currentEdgeMs.value - props.clip.timelineStart)
    }
  }

  return {
    left: `${timeMs * props.pixelsPerMs}px`,
    width: `${widthMs * props.pixelsPerMs}px`,
    opacity: isOutsideTimeline.value ? 0.5 : 1,
    transform: isOutsideTimeline.value ? 'scale(0.95)' : 'scale(1)',
  }
})

const clipColor = computed(() => getTrackColor(props.clip.type))

function handlePointerDown(event: PointerEvent) {
  // Only handle left mouse button
  if (event.button !== 0) return

  event.preventDefault()
  event.stopPropagation()

  // Select the clip
  emit('select', props.clip.id)

  // Start drag
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartTimeMs.value = props.clip.timelineStart
  currentTimeMs.value = props.clip.timelineStart
  isSnapped.value = false
  isOutsideTimeline.value = false

  // Capture pointer
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)

  // Add global listeners
  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerUp)
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value) return

  const deltaX = event.clientX - dragStartX.value
  const deltaTimeMs = deltaX / props.pixelsPerMs
  let newTimeMs = Math.max(0, dragStartTimeMs.value + deltaTimeMs)

  // Track Y position for cross-track dragging
  lastClientY.value = event.clientY

  // Check if outside timeline (vertically)
  if (props.timelineElement) {
    const rect = props.timelineElement.getBoundingClientRect()
    const outsideThreshold = 40
    isOutsideTimeline.value
      = event.clientY < rect.top - outsideThreshold
        || event.clientY > rect.bottom + outsideThreshold
  }

  // Apply snap if not outside
  if (!isOutsideTimeline.value) {
    const snapResult = snapToMarker(newTimeMs, props.pixelsPerMs)
    newTimeMs = snapResult.time
    isSnapped.value = snapResult.snapped
  }

  currentTimeMs.value = newTimeMs

  // Emit move with Y position for ghost element
  emit('move', props.clip.id, newTimeMs, event.clientY)
}

function handlePointerUp(event: PointerEvent) {
  if (!isDragging.value) return

  // Remove listeners
  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerup', handlePointerUp)

  // Release pointer
  ;(event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId)

  const finalTimeMs = currentTimeMs.value
  const removed = isOutsideTimeline.value
  const clientY = lastClientY.value

  // Reset state
  isDragging.value = false
  isSnapped.value = false
  isOutsideTimeline.value = false

  // Emit move end with Y position for cross-track detection
  emit('moveEnd', props.clip.id, finalTimeMs, removed, clientY)
}

function handleClick(event: MouseEvent) {
  // Prevent click after drag or resize
  if (isDragging.value || isResizing.value) {
    event.stopPropagation()
    return
  }
  emit('select', props.clip.id)
}

// Resize handlers
function handleResizePointerDown(event: PointerEvent, edge: 'left' | 'right') {
  if (event.button !== 0) return

  event.preventDefault()
  event.stopPropagation()

  // Select the clip
  emit('select', props.clip.id)

  // Start resize
  isResizing.value = true
  resizeEdge.value = edge
  resizeStartX.value = event.clientX

  if (edge === 'left') {
    resizeStartEdgeMs.value = props.clip.timelineStart
    currentEdgeMs.value = props.clip.timelineStart
  } else {
    resizeStartEdgeMs.value = props.clip.timelineStart + props.clip.duration
    currentEdgeMs.value = resizeStartEdgeMs.value
  }

  isResizeSnapped.value = false

  // Capture pointer
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)

  // Add global listeners
  document.addEventListener('pointermove', handleResizePointerMove)
  document.addEventListener('pointerup', handleResizePointerUp)
}

function handleResizePointerMove(event: PointerEvent) {
  if (!isResizing.value) return

  const deltaX = event.clientX - resizeStartX.value
  const deltaTimeMs = deltaX / props.pixelsPerMs
  let newEdgeMs = resizeStartEdgeMs.value + deltaTimeMs

  // Clamp to valid range
  if (resizeEdge.value === 'left') {
    // Left edge can't go past right edge - 100ms
    const maxLeft = props.clip.timelineStart + props.clip.duration - 100
    newEdgeMs = Math.max(0, Math.min(newEdgeMs, maxLeft))
  } else {
    // Right edge can't go past left edge + 100ms
    const minRight = props.clip.timelineStart + 100
    newEdgeMs = Math.max(minRight, newEdgeMs)
  }

  // Apply snap
  const snapResult = snapToMarker(newEdgeMs, props.pixelsPerMs)
  newEdgeMs = snapResult.time
  isResizeSnapped.value = snapResult.snapped

  currentEdgeMs.value = newEdgeMs

  // Emit resize for preview
  emit('resize', props.clip.id, resizeEdge.value, newEdgeMs)
}

function handleResizePointerUp(event: PointerEvent) {
  if (!isResizing.value) return

  // Remove listeners
  document.removeEventListener('pointermove', handleResizePointerMove)
  document.removeEventListener('pointerup', handleResizePointerUp)

  // Release pointer
  ;(event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId)

  const finalEdgeMs = currentEdgeMs.value
  const edge = resizeEdge.value

  // Reset state
  isResizing.value = false
  isResizeSnapped.value = false

  // Emit resize end
  emit('resizeEnd', props.clip.id, edge, finalEdgeMs)
}
</script>

<template>
  <div
    class="absolute top-0.5 bottom-0.5 rounded flex items-center overflow-hidden transition-all duration-75 group"
    :class="[
      `bg-${clipColor}-500/30 border border-${clipColor}-500/50`,
      isSelected ? `ring-2 ring-${clipColor}-500 shadow-lg` : 'hover:shadow-md',
      isDragging ? 'cursor-grabbing z-50 shadow-xl' : '',
      isResizing ? 'z-50 shadow-xl' : '',
      (isSnapped && isDragging) || (isResizeSnapped && isResizing) ? 'ring-2 ring-yellow-400' : '',
      isOutsideTimeline ? 'border-red-500 bg-red-500/20' : '',
    ]"
    :style="clipStyle"
    @click="handleClick"
  >
    <!-- Left resize handle -->
    <div
      class="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      :class="isResizing && resizeEdge === 'left' ? 'opacity-100' : ''"
      @pointerdown="(e) => handleResizePointerDown(e, 'left')"
    >
      <div class="w-0.5 h-4 bg-white/70 rounded-full" />
    </div>

    <!-- Main draggable area -->
    <div
      class="flex-1 h-full flex items-center px-3 cursor-grab"
      :class="isDragging ? 'cursor-grabbing' : ''"
      @pointerdown="handlePointerDown"
    >
      <span
        class="text-xs font-medium truncate select-none"
        :class="`text-${clipColor}-700 dark:text-${clipColor}-300`"
      >
        {{ mediaFile?.name || clip.id.slice(0, 8) }}
      </span>
    </div>

    <!-- Right resize handle -->
    <div
      class="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      :class="isResizing && resizeEdge === 'right' ? 'opacity-100' : ''"
      @pointerdown="(e) => handleResizePointerDown(e, 'right')"
    >
      <div class="w-0.5 h-4 bg-white/70 rounded-full" />
    </div>

    <!-- Snap indicator for left edge -->
    <div
      v-if="(isSnapped && isDragging) || (isResizeSnapped && isResizing && resizeEdge === 'left')"
      class="absolute left-0 top-0 bottom-0 w-0.5 bg-yellow-400"
    />

    <!-- Snap indicator for right edge -->
    <div
      v-if="isResizeSnapped && isResizing && resizeEdge === 'right'"
      class="absolute right-0 top-0 bottom-0 w-0.5 bg-yellow-400"
    />
  </div>
</template>
