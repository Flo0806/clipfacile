/**
 * Preview Engine
 *
 * Manages real-time playback synchronization for the video editor preview.
 * Uses requestAnimationFrame for smooth timing and coordinates all media elements.
 */

export interface ActiveClip {
  clipId: string
  sourceId: string
  type: 'video' | 'audio' | 'image'
  timelineStart: number
  duration: number
  sourceStart: number
  sourceEnd: number
}

// Shared state (singleton pattern)
const isPlaying = ref(false)
const playbackRate = ref(1)
const mediaElements = new Map<string, HTMLVideoElement | HTMLAudioElement>()
let animationFrameId: number | null = null
let lastFrameTime: number = 0

export function usePreviewEngine() {
  const { state, setCurrentTime, setIsPlaying } = useEditorState()

  /**
   * Get clips that are active at the given time
   */
  function getActiveClips(timeMs: number): ActiveClip[] {
    return state.clips
      .filter((clip) => {
        const clipEnd = clip.timelineStart + clip.duration
        return timeMs >= clip.timelineStart && timeMs < clipEnd
      })
      .map((clip) => ({
        clipId: clip.id,
        sourceId: (clip as { sourceId?: string }).sourceId ?? '',
        type: clip.type === 'video' ? 'video' : clip.type === 'audio' ? 'audio' : 'image',
        timelineStart: clip.timelineStart,
        duration: clip.duration,
        sourceStart: clip.sourceStart ?? 0,
        sourceEnd: clip.sourceEnd ?? clip.duration,
      }))
      .filter((clip) => clip.type !== 'image' || clip.sourceId) as ActiveClip[]
  }

  /**
   * Calculate the source time for a clip at the given timeline time
   */
  function getSourceTime(clip: ActiveClip, timelineTimeMs: number): number {
    const offsetInClip = timelineTimeMs - clip.timelineStart
    return clip.sourceStart + offsetInClip
  }

  /**
   * Sync a media element to the current time
   */
  function syncMediaElement(
    element: HTMLVideoElement | HTMLAudioElement,
    clip: ActiveClip,
    timelineTimeMs: number,
    shouldPlay: boolean,
  ) {
    const sourceTimeMs = getSourceTime(clip, timelineTimeMs)
    const sourceTimeSec = sourceTimeMs / 1000
    const isAudio = element instanceof HTMLAudioElement
    const timeDiff = Math.abs(element.currentTime - sourceTimeSec)

    // Different sync strategies for audio vs video
    // Audio: only seek on start or significant drift (>0.5s) to avoid stuttering
    // Video: more aggressive sync (>0.1s) for visual accuracy
    const syncThreshold = isAudio ? 0.5 : 0.1

    const needsSeek = timeDiff > syncThreshold

    if (shouldPlay) {
      if (element.paused) {
        // Starting playback - always sync position first
        element.currentTime = sourceTimeSec
        element.play().catch(() => {
          // Autoplay blocked - user interaction required
        })
      } else if (needsSeek) {
        // Already playing but drifted - resync
        element.currentTime = sourceTimeSec
      }
      // Otherwise let it play naturally
    } else {
      if (!element.paused) {
        element.pause()
      }
    }
  }

  /**
   * Main playback loop
   */
  function playbackLoop(currentFrameTime: number) {
    if (!isPlaying.value) return

    // Calculate delta time
    const deltaMs = lastFrameTime ? (currentFrameTime - lastFrameTime) * playbackRate.value : 0
    lastFrameTime = currentFrameTime

    // Update current time
    const newTime = state.currentTime + deltaMs

    // Check if we've reached the end
    if (newTime >= state.duration) {
      pause()
      setCurrentTime(state.duration)
      return
    }

    setCurrentTime(newTime)

    // Sync active media elements
    const activeClips = getActiveClips(newTime)
    const activeClipIds = new Set(activeClips.map((c) => c.clipId))

    // Sync active elements
    for (const clip of activeClips) {
      const element = mediaElements.get(clip.clipId)
      if (element) {
        syncMediaElement(element, clip, newTime, true)
      }
    }

    // Pause inactive elements
    for (const [clipId, element] of mediaElements) {
      if (!activeClipIds.has(clipId) && !element.paused) {
        element.pause()
      }
    }

    // Schedule next frame
    animationFrameId = requestAnimationFrame(playbackLoop)
  }

  /**
   * Start playback
   */
  function play() {
    if (isPlaying.value) return

    // If at the end, restart from beginning
    if (state.currentTime >= state.duration) {
      setCurrentTime(0)
    }

    isPlaying.value = true
    setIsPlaying(true)
    lastFrameTime = 0
    animationFrameId = requestAnimationFrame(playbackLoop)
  }

  /**
   * Pause playback
   */
  function pause() {
    isPlaying.value = false
    setIsPlaying(false)

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    // Pause all media elements
    for (const element of mediaElements.values()) {
      if (!element.paused) {
        element.pause()
      }
    }
  }

  /**
   * Toggle play/pause
   */
  function togglePlayback() {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  /**
   * Seek to a specific time
   */
  function seek(timeMs: number) {
    const clampedTime = Math.max(0, Math.min(timeMs, state.duration))
    setCurrentTime(clampedTime)

    // Sync all active media elements to new position
    const activeClips = getActiveClips(clampedTime)
    for (const clip of activeClips) {
      const element = mediaElements.get(clip.clipId)
      if (element) {
        const sourceTimeSec = getSourceTime(clip, clampedTime) / 1000
        element.currentTime = sourceTimeSec
      }
    }
  }

  /**
   * Stop playback and reset to beginning
   */
  function stop() {
    pause()
    setCurrentTime(0)
  }

  /**
   * Register a media element for a clip
   */
  function registerMediaElement(clipId: string, element: HTMLVideoElement | HTMLAudioElement) {
    mediaElements.set(clipId, element)
  }

  /**
   * Unregister a media element
   */
  function unregisterMediaElement(clipId: string) {
    const element = mediaElements.get(clipId)
    if (element && !element.paused) {
      element.pause()
    }
    mediaElements.delete(clipId)
  }

  /**
   * Set playback rate (1 = normal, 0.5 = half speed, 2 = double speed)
   */
  function setPlaybackRate(rate: number) {
    playbackRate.value = Math.max(0.25, Math.min(4, rate))

    // Update all media elements
    for (const element of mediaElements.values()) {
      element.playbackRate = playbackRate.value
    }
  }

  return {
    // State
    isPlaying: readonly(isPlaying),
    playbackRate: readonly(playbackRate),

    // Playback controls
    play,
    pause,
    togglePlayback,
    seek,
    stop,
    setPlaybackRate,

    // Media element management
    registerMediaElement,
    unregisterMediaElement,

    // Utilities
    getActiveClips,
    getSourceTime,
  }
}
