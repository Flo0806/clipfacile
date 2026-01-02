<script setup lang="ts">
const { t } = useI18n()
const { state, getMediaFile } = useEditorState()
const {
  initCompositor,
  resizeCompositor,
  registerMediaElement,
  registerImageElement,
  unregisterMediaElement,
  unregisterImageElement,
} = usePreviewEngine()

// Container ref for compositor canvas
const containerRef = ref<HTMLElement>()

// Track mounted media elements
const videoRefs = ref<Map<string, HTMLVideoElement>>(new Map())
const audioRefs = ref<Map<string, HTMLAudioElement>>(new Map())
const imageRefs = ref<Map<string, HTMLImageElement>>(new Map())

// Get all video clips that need video elements
const videoClips = computed(() => {
  return state.clips
    .filter((clip) => {
      if (clip.type !== 'video') return false
      const sourceId = (clip as { sourceId: string }).sourceId
      const mediaFile = getMediaFile(sourceId)
      // Only actual videos, not images on video tracks
      return mediaFile && mediaFile.type === 'video'
    })
    .map((clip) => {
      const sourceId = (clip as { sourceId: string }).sourceId
      const mediaFile = getMediaFile(sourceId)
      return {
        clipId: clip.id,
        sourceId,
        url: mediaFile?.url ?? '',
      }
    })
    .filter((clip) => clip.url)
})

// Get all image clips (images on video tracks)
const imageClips = computed(() => {
  return state.clips
    .filter((clip) => {
      if (clip.type !== 'video') return false
      const sourceId = (clip as { sourceId: string }).sourceId
      const mediaFile = getMediaFile(sourceId)
      return mediaFile && mediaFile.type === 'image'
    })
    .map((clip) => {
      const sourceId = (clip as { sourceId: string }).sourceId
      const mediaFile = getMediaFile(sourceId)
      return {
        clipId: clip.id,
        sourceId,
        url: mediaFile?.url ?? '',
      }
    })
    .filter((clip) => clip.url)
})

// Get all audio clips
const audioClips = computed(() => {
  return state.clips
    .filter((clip) => clip.type === 'audio')
    .map((clip) => {
      const sourceId = (clip as { sourceId: string }).sourceId
      const mediaFile = getMediaFile(sourceId)
      return {
        clipId: clip.id,
        sourceId,
        url: mediaFile?.url ?? '',
      }
    })
    .filter((clip) => clip.url)
})

// Resize observer (stored for cleanup)
let resizeObserver: ResizeObserver | null = null

// Initialize compositor when container is mounted
onMounted(async () => {
  if (containerRef.value) {
    await initCompositor(containerRef.value)

    // Setup resize observer
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        resizeCompositor(entry.contentRect.width, entry.contentRect.height)
      }
    })
    resizeObserver.observe(containerRef.value)
  }
})

// Register/unregister video elements
function onVideoMounted(clipId: string, el: HTMLVideoElement | null) {
  if (el) {
    videoRefs.value.set(clipId, el)

    // Firefox/WebM: videoWidth may be 0 even when readyState=4
    // Wait for dimensions to be available
    let retryCount = 0
    const checkDimensions = () => {
      retryCount++
      if (el.videoWidth > 0) {
        registerMediaElement(clipId, el)
      } else if (retryCount < 50) {
        // Retry up to 5 seconds
        setTimeout(checkDimensions, 100)
      } else {
        // Fallback: register anyway, let compositor handle it
        registerMediaElement(clipId, el)
      }
    }

    if (el.videoWidth > 0) {
      registerMediaElement(clipId, el)
    } else {
      checkDimensions()
    }
  } else {
    const existing = videoRefs.value.get(clipId)
    if (existing) {
      videoRefs.value.delete(clipId)
      unregisterMediaElement(clipId)
    }
  }
}

// Register/unregister audio elements
function onAudioMounted(clipId: string, el: HTMLAudioElement | null) {
  if (el) {
    audioRefs.value.set(clipId, el)
    registerMediaElement(clipId, el)
  } else {
    const existing = audioRefs.value.get(clipId)
    if (existing) {
      audioRefs.value.delete(clipId)
      unregisterMediaElement(clipId)
    }
  }
}

// Register/unregister image elements
function onImageLoaded(clipId: string, el: HTMLImageElement | null) {
  if (el) {
    imageRefs.value.set(clipId, el)
    registerImageElement(clipId, el)
  } else {
    const existing = imageRefs.value.get(clipId)
    if (existing) {
      imageRefs.value.delete(clipId)
      unregisterImageElement(clipId)
    }
  }
}

// Cleanup on unmount
onUnmounted(() => {
  // Disconnect resize observer
  resizeObserver?.disconnect()
  resizeObserver = null

  // Unregister all media elements
  for (const clipId of videoRefs.value.keys()) {
    unregisterMediaElement(clipId)
  }
  for (const clipId of audioRefs.value.keys()) {
    unregisterMediaElement(clipId)
  }
  for (const clipId of imageRefs.value.keys()) {
    unregisterImageElement(clipId)
  }
})
</script>

<template>
  <div class="relative w-full h-full bg-black overflow-hidden">
    <!-- WebGL Compositor Canvas Container -->
    <div
      ref="containerRef"
      class="absolute inset-0 w-full h-full"
    />

    <!-- Hidden Video Elements (feed compositor + audio mixer) -->
    <!-- Note: NOT muted - audio flows through Web Audio API -->
    <!-- preload="auto" needed so video frames are available for WebGL texture -->
    <video
      v-for="clip in videoClips"
      :key="clip.clipId"
      :src="clip.url"
      class="hidden"
      playsinline
      preload="auto"
      @loadeddata="(e) => onVideoMounted(clip.clipId, e.target as HTMLVideoElement)"
    />

    <!-- Hidden Image Elements (feed compositor) -->
    <img
      v-for="clip in imageClips"
      :key="clip.clipId"
      :src="clip.url"
      class="hidden"
      @load="(e) => onImageLoaded(clip.clipId, e.target as HTMLImageElement)"
    >

    <!-- Hidden Audio Elements (feed audio mixer) -->
    <audio
      v-for="clip in audioClips"
      :key="clip.clipId"
      :src="clip.url"
      preload="auto"
      @loadeddata="(e) => onAudioMounted(clip.clipId, e.target as HTMLAudioElement)"
    />

    <!-- Empty state -->
    <div
      v-if="state.clips.length === 0"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <span class="text-gray-500">{{ t('editor.preview') }}</span>
    </div>
  </div>
</template>
