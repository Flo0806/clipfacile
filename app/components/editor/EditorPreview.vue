<script setup lang="ts">
const { state, getMediaFile } = useEditorState()
const { getActiveClips, registerMediaElement, unregisterMediaElement } = usePreviewEngine()

// Track mounted media elements
const videoRefs = ref<Map<string, HTMLVideoElement>>(new Map())
const audioRefs = ref<Map<string, HTMLAudioElement>>(new Map())

// Get all video/audio clips that need media elements
const mediaClips = computed(() => {
  return state.clips
    .filter((clip) => clip.type === 'video' || clip.type === 'audio')
    .map((clip) => {
      const sourceId = (clip as { sourceId: string }).sourceId
      const mediaFile = getMediaFile(sourceId)
      return {
        clipId: clip.id,
        type: clip.type as 'video' | 'audio',
        sourceId,
        url: mediaFile?.url ?? '',
        timelineStart: clip.timelineStart,
        duration: clip.duration,
      }
    })
    .filter((clip) => clip.url)
})

// Get currently visible video clip (topmost active video)
const activeVideoClip = computed(() => {
  const activeClips = getActiveClips(state.currentTime)
  const videoClip = activeClips.find((c) => c.type === 'video')
  return videoClip?.clipId ?? null
})

// Get currently visible image
const activeImageClip = computed(() => {
  const imageClips = state.clips.filter((clip) => {
    if (clip.type !== 'video') return false
    const mediaFile = getMediaFile((clip as { sourceId: string }).sourceId)
    if (!mediaFile || mediaFile.type !== 'image') return false

    const clipEnd = clip.timelineStart + clip.duration
    return state.currentTime >= clip.timelineStart && state.currentTime < clipEnd
  })

  if (imageClips.length === 0) return null

  // Return the topmost (last in array) image
  const clip = imageClips[imageClips.length - 1]!
  const mediaFile = getMediaFile((clip as { sourceId: string }).sourceId)
  return {
    clipId: clip.id,
    url: mediaFile?.url ?? '',
  }
})

// Register/unregister video elements
function onVideoMounted(clipId: string, el: HTMLVideoElement | null) {
  if (el) {
    videoRefs.value.set(clipId, el)
    registerMediaElement(clipId, el)
  } else {
    videoRefs.value.delete(clipId)
    unregisterMediaElement(clipId)
  }
}

// Register/unregister audio elements
function onAudioMounted(clipId: string, el: HTMLAudioElement | null) {
  if (el) {
    audioRefs.value.set(clipId, el)
    registerMediaElement(clipId, el)
  } else {
    audioRefs.value.delete(clipId)
    unregisterMediaElement(clipId)
  }
}

// Cleanup on unmount
onUnmounted(() => {
  for (const clipId of videoRefs.value.keys()) {
    unregisterMediaElement(clipId)
  }
  for (const clipId of audioRefs.value.keys()) {
    unregisterMediaElement(clipId)
  }
})
</script>

<template>
  <div class="relative w-full h-full bg-black overflow-hidden">
    <!-- Video elements (hidden, only active one shown) -->
    <video
      v-for="clip in mediaClips.filter(c => c.type === 'video')"
      :key="clip.clipId"
      :ref="(el) => onVideoMounted(clip.clipId, el as HTMLVideoElement)"
      :src="clip.url"
      class="absolute inset-0 w-full h-full object-contain"
      :class="activeVideoClip === clip.clipId ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      muted
      playsinline
      preload="auto"
    />

    <!-- Active image -->
    <img
      v-if="activeImageClip"
      :key="activeImageClip.clipId"
      :src="activeImageClip.url"
      class="absolute inset-0 w-full h-full object-contain"
      alt=""
    >

    <!-- Audio elements (always hidden) -->
    <audio
      v-for="clip in mediaClips.filter(c => c.type === 'audio')"
      :key="clip.clipId"
      :ref="(el) => onAudioMounted(clip.clipId, el as HTMLAudioElement)"
      :src="clip.url"
      preload="auto"
    />

    <!-- Empty state -->
    <div
      v-if="state.clips.length === 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <span class="text-gray-500">Vorschau</span>
    </div>
  </div>
</template>
