<script setup lang="ts">
const { t } = useI18n()
const {
  state,
  getClipsForTrack,
  addClip,
  moveClip,
  removeClip,
  resizeClip,
  selectClip,
  addTrack,
  zoomIn,
  zoomOut,
} = useEditorState()

const timelineRef = ref<HTMLElement>()
const containerWidth = ref(800)
const pixelsPerMs = computed(() => 0.1 * state.zoom) // 0.1px per ms at zoom 1

// Content width for tracks (excluding label area)
const LABEL_WIDTH = 96 // w-24
const timelineWidth = computed(() => {
  const visibleWidth = Math.max(0, containerWidth.value - LABEL_WIDTH)
  const contentWidth = state.duration * pixelsPerMs.value
  return Math.max(visibleWidth, contentWidth + 100)
})

// Track container width
onMounted(() => {
  if (timelineRef.value) {
    containerWidth.value = timelineRef.value.clientWidth
    const observer = new ResizeObserver((entries) => {
      containerWidth.value = entries[0]?.contentRect.width ?? 800
    })
    observer.observe(timelineRef.value)
    onUnmounted(() => observer.disconnect())
  }
})

function handleDropMedia(mediaId: string, trackId: string, timeMs: number) {
  addClip(mediaId, trackId, timeMs)
}

function handleMoveClip(clipId: string, trackId: string, timeMs: number) {
  const success = moveClip(clipId, trackId, timeMs)
  if (!success) {
    // Could not move - maybe collision, try creating new track
    const clip = state.clips.find((c) => c.id === clipId)
    if (clip) {
      const track = state.tracks.find((t) => t.id === trackId)
      if (track && track.type === clip.type) {
        // Same type, collision - create new track and move there
        const newTrack = addTrack(clip.type)
        moveClip(clipId, newTrack.id, timeMs)
      }
    }
  }
}

function handleSelectClip(clipId: string) {
  selectClip(clipId)
}

function handleRemoveClip(clipId: string) {
  removeClip(clipId)
}

function handleResizeClip(clipId: string, edge: 'left' | 'right', newEdgeTimeMs: number) {
  resizeClip(clipId, edge, newEdgeTimeMs)
}

// DnD handler for media drops from library
function handleTimelineDragOver(event: DragEvent) {
  event.preventDefault()
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Timeline Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
      <h3 class="text-sm font-semibold">
        {{ t('editor.timeline') }}
      </h3>
      <div class="flex items-center gap-2">
        <u-button
          icon="i-heroicons-minus"
          variant="ghost"
          color="neutral"
          size="xs"
          :aria-label="t('editor.zoomOut')"
          @click="zoomOut"
        />
        <u-button
          icon="i-heroicons-plus"
          variant="ghost"
          color="neutral"
          size="xs"
          :aria-label="t('editor.zoomIn')"
          @click="zoomIn"
        />
        <u-dropdown-menu
          :items="[
            { label: t('editor.video'), icon: 'i-heroicons-video-camera', click: () => addTrack('video') },
            { label: t('editor.audio'), icon: 'i-heroicons-musical-note', click: () => addTrack('audio') },
            { label: t('editor.text'), icon: 'i-heroicons-bars-3-bottom-left', click: () => addTrack('text') },
          ]"
        >
          <u-button
            icon="i-heroicons-plus"
            variant="soft"
            color="primary"
            size="xs"
          >
            {{ t('editor.addTrack') }}
          </u-button>
        </u-dropdown-menu>
      </div>
    </div>

    <!-- Tracks Area with Ruler -->
    <div
      ref="timelineRef"
      class="flex-1 overflow-auto"
      @dragover="handleTimelineDragOver"
    >
      <!-- Time Ruler -->
      <editor-ruler
        :pixels-per-ms="pixelsPerMs"
        :duration="state.duration"
        :container-width="containerWidth"
      />

      <!-- Tracks -->
      <div class="py-1 px-2 space-y-1">
        <editor-track
          v-for="track in state.tracks"
          :key="track.id"
          :track="track"
          :clips="getClipsForTrack(track.id)"
          :pixels-per-ms="pixelsPerMs"
          :selected-clip-id="state.selectedClipId"
          :timeline-width="timelineWidth"
          :timeline-element="timelineRef ?? null"
          @drop-media="handleDropMedia"
          @move-clip="handleMoveClip"
          @select-clip="handleSelectClip"
          @remove-clip="handleRemoveClip"
          @resize-clip="handleResizeClip"
        />

        <!-- Empty state -->
        <div
          v-if="state.tracks.length === 0"
          class="flex items-center justify-center h-32 text-gray-400"
        >
          {{ t('editor.addTrack') }}
        </div>
      </div>
    </div>
  </div>
</template>
