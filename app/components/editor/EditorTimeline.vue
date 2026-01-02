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
  removeTrack,
  zoomIn,
  zoomOut,
} = useEditorState()
const { seek } = usePreviewEngine()

// Delete confirmation dialog state
const showDeleteDialog = ref(false)
const trackToDelete = ref<string | null>(null)
const trackToDeleteHasClips = ref(false)

// Ghost element state for cross-track dragging
const ghostState = ref<{
  clipId: string
  targetTrackId: string | null
  sourceTrackId: string
  timeMs: number
  durationMs: number
} | null>(null)

const timelineRef = ref<HTMLElement>()
const tracksContainerRef = ref<HTMLElement>()
const containerWidth = ref(800)
const pixelsPerMs = computed(() => 0.1 * state.zoom) // 0.1px per ms at zoom 1

// Content width for tracks (excluding label area)
const LABEL_WIDTH = 128 // w-32
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

/**
 * Find the track at a given Y position
 */
function findTrackAtY(clientY: number, clipType: string): Track | null {
  if (!tracksContainerRef.value) return null

  const trackElements = tracksContainerRef.value.querySelectorAll('[data-track-id]')
  for (const el of trackElements) {
    const rect = el.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      const trackId = el.getAttribute('data-track-id')
      const track = state.tracks.find((t) => t.id === trackId)
      // Only return if compatible type
      if (track && track.type === clipType) {
        return track
      }
    }
  }
  return null
}

function handleClipDrag(clipId: string, timeMs: number, durationMs: number, clientY: number) {
  const clip = state.clips.find((c) => c.id === clipId)
  if (!clip) return

  const targetTrack = findTrackAtY(clientY, clip.type)
  const sourceTrackId = clip.trackId

  // Only show ghost if moving to a different track
  if (targetTrack && targetTrack.id !== sourceTrackId) {
    ghostState.value = {
      clipId,
      targetTrackId: targetTrack.id,
      sourceTrackId,
      timeMs,
      durationMs,
    }
  } else {
    ghostState.value = null
  }
}

function handleClipDragEnd() {
  ghostState.value = null
}

function handleMoveClip(clipId: string, sourceTrackId: string, timeMs: number, clientY: number) {
  ghostState.value = null

  const clip = state.clips.find((c) => c.id === clipId)
  if (!clip) return

  // Find target track based on Y position
  const targetTrack = findTrackAtY(clientY, clip.type)
  const targetTrackId = targetTrack?.id ?? sourceTrackId

  const success = moveClip(clipId, targetTrackId, timeMs)
  if (!success) {
    // Could not move - maybe collision, try creating new track
    const track = state.tracks.find((t) => t.id === targetTrackId)
    if (track && track.type === clip.type) {
      // Same type, collision - create new track and move there
      const newTrack = addTrack(clip.type)
      if (newTrack) {
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

// Ruler click handler - uses seek() to sync video elements
function handleRulerClick(timeMs: number) {
  seek(timeMs)
}

// Track deletion
function handleDeleteTrackRequest(trackId: string, hasClips: boolean) {
  if (hasClips) {
    // Show confirmation dialog
    trackToDelete.value = trackId
    trackToDeleteHasClips.value = true
    showDeleteDialog.value = true
  } else {
    // Delete directly
    removeTrack(trackId)
  }
}

function confirmDeleteTrack() {
  if (trackToDelete.value) {
    removeTrack(trackToDelete.value)
  }
  showDeleteDialog.value = false
  trackToDelete.value = null
}

function cancelDeleteTrack() {
  showDeleteDialog.value = false
  trackToDelete.value = null
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
        <u-tooltip :text="t('editor.zoomOut')">
          <u-button
            icon="i-heroicons-minus"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('editor.zoomOut')"
            @click="zoomOut"
          />
        </u-tooltip>
        <u-tooltip :text="t('editor.zoomIn')">
          <u-button
            icon="i-heroicons-plus"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('editor.zoomIn')"
            @click="zoomIn"
          />
        </u-tooltip>
        <u-dropdown-menu
          :items="[
            { label: t('editor.video'), icon: 'i-heroicons-video-camera', onSelect: () => addTrack('video') },
            { label: t('editor.audio'), icon: 'i-heroicons-musical-note', onSelect: () => addTrack('audio') },
            { label: t('editor.text'), icon: 'i-heroicons-bars-3-bottom-left', onSelect: () => addTrack('text') },
          ]"
        >
          <u-tooltip :text="t('editor.addTrack')">
            <u-button
              icon="i-heroicons-plus"
              variant="soft"
              color="primary"
              size="xs"
            >
              {{ t('editor.addTrack') }}
            </u-button>
          </u-tooltip>
        </u-dropdown-menu>
      </div>
    </div>

    <!-- Tracks Area with Ruler -->
    <div
      ref="timelineRef"
      class="flex-1 overflow-auto relative"
      @dragover="handleTimelineDragOver"
    >
      <!-- Playhead -->
      <editor-playhead
        :current-time="state.currentTime"
        :pixels-per-ms="pixelsPerMs"
      />

      <!-- Time Ruler -->
      <editor-ruler
        :pixels-per-ms="pixelsPerMs"
        :duration="state.duration"
        :container-width="containerWidth"
        @seek="handleRulerClick"
      />

      <!-- Tracks -->
      <div
        ref="tracksContainerRef"
        class="py-1 px-2 space-y-1"
      >
        <editor-track
          v-for="track in state.tracks"
          :key="track.id"
          :data-track-id="track.id"
          :track="track"
          :clips="getClipsForTrack(track.id)"
          :pixels-per-ms="pixelsPerMs"
          :selected-clip-id="state.selectedClipId"
          :timeline-width="timelineWidth"
          :timeline-element="timelineRef ?? null"
          :ghost-clip="ghostState?.targetTrackId === track.id ? { timeMs: ghostState.timeMs, durationMs: ghostState.durationMs } : null"
          @drop-media="handleDropMedia"
          @clip-drag="handleClipDrag"
          @clip-drag-end="handleClipDragEnd"
          @move-clip="handleMoveClip"
          @select-clip="handleSelectClip"
          @remove-clip="handleRemoveClip"
          @resize-clip="handleResizeClip"
          @delete-track="handleDeleteTrackRequest"
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

    <!-- Delete Track Confirmation Dialog -->
    <dialogs-confirm-dialog
      v-model:open="showDeleteDialog"
      :title="t('editor.deleteTrackTitle')"
      :description="t('editor.deleteTrackConfirm')"
      :confirm-label="t('common.delete')"
      confirm-color="error"
      @confirm="confirmDeleteTrack"
      @cancel="cancelDeleteTrack"
    />
  </div>
</template>
