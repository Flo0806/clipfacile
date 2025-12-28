<script setup lang="ts">
const props = defineProps<{
  track: Track
  clips: Clip[]
  pixelsPerMs: number
  selectedClipId: string | null
  timelineWidth: number
  timelineElement: HTMLElement | null
}>()

const emit = defineEmits<{
  dropMedia: [mediaId: string, trackId: string, timeMs: number]
  moveClip: [clipId: string, trackId: string, timeMs: number]
  removeClip: [clipId: string]
  selectClip: [clipId: string]
  resizeClip: [clipId: string, edge: 'left' | 'right', newEdgeTimeMs: number]
}>()

const { getMediaFile, snapToMarker } = useEditorState()

const trackRef = ref<HTMLElement>()
const isDragOver = ref(false)

const trackColor = computed(() => {
  switch (props.track.type) {
    case 'video': return 'cyan'
    case 'audio': return 'purple'
    case 'text': return 'gray'
    default: return 'gray'
  }
})

// DnD handlers - only for media drops from library
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    const types = event.dataTransfer.types
    // Only handle media drags from library
    const isMediaDrag = types.includes('application/clipfacile-video') || types.includes('application/clipfacile-audio')

    if (isMediaDrag) {
      const draggedClipType = types.includes('application/clipfacile-video') ? 'video' : 'audio'
      const isCompatible = props.track.type === draggedClipType
      event.dataTransfer.dropEffect = isCompatible ? 'copy' : 'none'
      isDragOver.value = isCompatible
    } else {
      event.dataTransfer.dropEffect = 'none'
      isDragOver.value = false
    }
  }
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false

  if (!event.dataTransfer || !trackRef.value) return

  const dataStr = event.dataTransfer.getData('application/json')
  if (!dataStr) return

  try {
    const data: DragData = JSON.parse(dataStr)
    // Only handle media drops, clips use pointer events now
    if (data.type === 'media') {
      const rect = trackRef.value.getBoundingClientRect()
      const x = event.clientX - rect.left
      const rawTimeMs = Math.max(0, x / props.pixelsPerMs)
      const { time: timeMs } = snapToMarker(rawTimeMs, props.pixelsPerMs)
      emit('dropMedia', data.id, props.track.id, timeMs)
    }
  } catch {
    // Invalid drag data
  }
}

// Clip event handlers
function handleSelectClip(clipId: string) {
  emit('selectClip', clipId)
}

function handleClipMove(_clipId: string, _newTimeMs: number) {
  // Could show preview/collision detection here
}

function handleClipMoveEnd(clipId: string, newTimeMs: number, removed: boolean) {
  if (removed) {
    emit('removeClip', clipId)
  } else {
    emit('moveClip', clipId, props.track.id, newTimeMs)
  }
}

function getClipSourceId(clip: Clip): string | undefined {
  if (clip.type === 'video' || clip.type === 'audio') {
    return clip.sourceId
  }
  return undefined
}

// Resize handlers
function handleClipResize(_clipId: string, _edge: 'left' | 'right', _newEdgeTimeMs: number) {
  // Could show preview here
}

function handleClipResizeEnd(clipId: string, edge: 'left' | 'right', newEdgeTimeMs: number) {
  emit('resizeClip', clipId, edge, newEdgeTimeMs)
}
</script>

<template>
  <div class="flex items-center gap-2 h-9">
    <!-- Track Label -->
    <div class="w-24 shrink-0 flex items-center gap-2 px-2">
      <div
        class="w-2 h-2 rounded-full"
        :class="`bg-${trackColor}-500`"
      />
      <span
        class="text-xs font-medium truncate"
        :class="`text-${trackColor}-600 dark:text-${trackColor}-400`"
      >
        {{ track.name }}
      </span>
    </div>

    <!-- Track Content -->
    <div
      ref="trackRef"
      class="flex-1 h-7 relative rounded transition-colors"
      :class="[
        isDragOver
          ? `bg-${trackColor}-500/20 border-2 border-dashed border-${trackColor}-500`
          : 'bg-gray-100 dark:bg-gray-800',
      ]"
      :style="{ minWidth: `${timelineWidth}px` }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <editor-clip
        v-for="clip in clips"
        :key="clip.id"
        :clip="clip"
        :media-file="getMediaFile(getClipSourceId(clip) ?? '')"
        :pixels-per-ms="pixelsPerMs"
        :is-selected="clip.id === selectedClipId"
        :timeline-element="timelineElement"
        :track-element="trackRef ?? null"
        @select="handleSelectClip"
        @move="handleClipMove"
        @move-end="handleClipMoveEnd"
        @resize="handleClipResize"
        @resize-end="handleClipResizeEnd"
      />
    </div>
  </div>
</template>
