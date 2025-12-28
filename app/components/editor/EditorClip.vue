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
  move: [clipId: string, newTimeMs: number]
  moveEnd: [clipId: string, newTimeMs: number, removed: boolean]
}>()

const { snapToMarker } = useEditorState()

// Drag state
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartTimeMs = ref(0)
const currentTimeMs = ref(props.clip.timelineStart)
const isSnapped = ref(false)
const isOutsideTimeline = ref(false)

// Keep currentTimeMs in sync when not dragging
watch(() => props.clip.timelineStart, (newTime) => {
  if (!isDragging.value) {
    currentTimeMs.value = newTime
  }
})

const clipStyle = computed(() => {
  const timeMs = isDragging.value ? currentTimeMs.value : props.clip.timelineStart
  return {
    left: `${timeMs * props.pixelsPerMs}px`,
    width: `${props.clip.duration * props.pixelsPerMs}px`,
    opacity: isOutsideTimeline.value ? 0.5 : 1,
    transform: isOutsideTimeline.value ? 'scale(0.95)' : 'scale(1)',
  }
})

const clipColor = computed(() => {
  switch (props.clip.type) {
    case 'video': return 'cyan'
    case 'audio': return 'purple'
    case 'text': return 'gray'
    default: return 'gray'
  }
})

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

  // Emit move for potential collision preview
  emit('move', props.clip.id, newTimeMs)
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

  // Reset state
  isDragging.value = false
  isSnapped.value = false
  isOutsideTimeline.value = false

  // Emit move end
  emit('moveEnd', props.clip.id, finalTimeMs, removed)
}

function handleClick(event: MouseEvent) {
  // Prevent click after drag
  if (isDragging.value) {
    event.stopPropagation()
    return
  }
  emit('select', props.clip.id)
}
</script>

<template>
  <div
    class="absolute top-0.5 bottom-0.5 rounded cursor-grab flex items-center px-2 overflow-hidden transition-all duration-75"
    :class="[
      `bg-${clipColor}-500/30 border border-${clipColor}-500/50`,
      isSelected ? `ring-2 ring-${clipColor}-500 shadow-lg` : 'hover:shadow-md',
      isDragging ? 'cursor-grabbing z-50 shadow-xl' : '',
      isSnapped ? 'ring-2 ring-yellow-400' : '',
      isOutsideTimeline ? 'border-red-500 bg-red-500/20' : '',
    ]"
    :style="clipStyle"
    @pointerdown="handlePointerDown"
    @click="handleClick"
  >
    <span
      class="text-xs font-medium truncate select-none"
      :class="`text-${clipColor}-700 dark:text-${clipColor}-300`"
    >
      {{ mediaFile?.name || clip.id.slice(0, 8) }}
    </span>

    <!-- Snap indicator -->
    <div
      v-if="isSnapped && isDragging"
      class="absolute left-0 top-0 bottom-0 w-0.5 bg-yellow-400"
    />
  </div>
</template>
