/**
 * Preview Engine - SIMPLIFIED
 *
 * Let the browser handle video playback. We just:
 * 1. Track timeline position
 * 2. Show/hide layers based on what's active
 * 3. Sync video positions only when needed (seek, drift)
 */

export interface ActiveClip {
  clipId: string
  trackId: string
  sourceId: string
  type: 'video' | 'audio' | 'image'
  timelineStart: number
  duration: number
  sourceStart: number
  sourceEnd: number
}

// Singleton state
const isPlaying = ref(false)
const mediaElements = new Map<string, HTMLVideoElement | HTMLAudioElement>()
let animationFrameId: number | null = null
let playStartTime = 0 // performance.now() when play started
let playStartPosition = 0 // timeline position when play started

// Compositor instance (lazy)
let compositor: ReturnType<typeof useCompositor> | null = null

export function usePreviewEngine() {
  const { state, setCurrentTime, setIsPlaying, getMediaFile } = useEditorState()

  function ensureCompositor() {
    if (!compositor) {
      compositor = useCompositor()
    }
  }

  /**
   * Get clips active at given time
   */
  function getActiveClips(timeMs: number): ActiveClip[] {
    return state.clips
      .filter((clip) => {
        const clipEnd = clip.timelineStart + clip.duration
        return timeMs >= clip.timelineStart && timeMs < clipEnd
      })
      .map((clip) => {
        const sourceId = (clip as { sourceId?: string }).sourceId ?? ''
        const mediaFile = getMediaFile(sourceId)
        const isImage = mediaFile?.type === 'image'

        let type: 'video' | 'audio' | 'image'
        if (clip.type === 'audio') {
          type = 'audio'
        } else if (isImage) {
          type = 'image'
        } else {
          type = 'video'
        }

        return {
          clipId: clip.id,
          trackId: clip.trackId,
          sourceId,
          type,
          timelineStart: clip.timelineStart,
          duration: clip.duration,
          sourceStart: clip.sourceStart ?? 0,
          sourceEnd: clip.sourceEnd ?? clip.duration,
        }
      })
      .filter((clip) => clip.sourceId) as ActiveClip[]
  }

  /**
   * Get visual clips sorted by track order
   * Higher order = behind, lower order = in front (top track in UI = foreground)
   */
  function getActiveVisualClips(timeMs: number): ActiveClip[] {
    return getActiveClips(timeMs)
      .filter((c) => c.type === 'video' || c.type === 'image')
      .sort((a, b) => {
        const trackA = state.tracks.find((t) => t.id === a.trackId)
        const trackB = state.tracks.find((t) => t.id === b.trackId)
        return (trackB?.order ?? 0) - (trackA?.order ?? 0)
      })
  }

  /**
   * Get audio clips
   */
  function getActiveAudioClips(timeMs: number): ActiveClip[] {
    return getActiveClips(timeMs).filter((c) => c.type === 'audio' || c.type === 'video')
  }

  /**
   * Calculate source time for a clip
   */
  function getSourceTime(clip: ActiveClip, timelineTimeMs: number): number {
    return clip.sourceStart + (timelineTimeMs - clip.timelineStart)
  }

  /**
   * Update compositor layer visibility
   */
  function updateCompositorVisibility(timeMs: number) {
    if (!compositor) return

    const activeClipIds = new Set(getActiveVisualClips(timeMs).map((c) => c.clipId))

    for (const layerId of compositor.getLayerIds()) {
      compositor.setLayerVisible(layerId, activeClipIds.has(layerId))
    }

    compositor.render()
  }

  // Track which clips are currently playing
  const playingClipIds = new Set<string>()

  /**
   * Main render loop - just updates time and compositor
   */
  function renderLoop() {
    if (!isPlaying.value) return

    // Calculate current time based on real elapsed time
    const elapsed = performance.now() - playStartTime
    const newTime = playStartPosition + elapsed

    // Check end
    if (newTime >= state.duration) {
      pause()
      setCurrentTime(state.duration)
      return
    }

    setCurrentTime(newTime)

    // Check for clips that need to start/stop
    const activeClips = getActiveClips(newTime)
    const activeClipIds = new Set(activeClips.map((c) => c.clipId))

    // Start newly active clips
    for (const clip of activeClips) {
      if (!playingClipIds.has(clip.clipId) && clip.type !== 'image') {
        const element = mediaElements.get(clip.clipId)
        if (element) {
          // Sync to correct position and play
          const sourceTimeSec = getSourceTime(clip, newTime) / 1000
          element.currentTime = sourceTimeSec
          element.play().catch(() => {})
          playingClipIds.add(clip.clipId)
        }
      }
    }

    // Stop clips that are no longer active
    for (const clipId of playingClipIds) {
      if (!activeClipIds.has(clipId)) {
        const element = mediaElements.get(clipId)
        if (element && !element.paused) {
          element.pause()
        }
        playingClipIds.delete(clipId)
      }
    }

    updateCompositorVisibility(newTime)

    animationFrameId = requestAnimationFrame(renderLoop)
  }

  /**
   * Sync all video elements to the given time
   */
  async function syncVideosToTime(timeMs: number): Promise<void> {
    const activeClips = getActiveClips(timeMs)
    const promises: Promise<void>[] = []

    for (const clip of activeClips) {
      if (clip.type === 'image') continue

      const element = mediaElements.get(clip.clipId)
      if (!element) continue

      const sourceTimeSec = getSourceTime(clip, timeMs) / 1000

      // Only seek if difference is significant
      if (Math.abs(element.currentTime - sourceTimeSec) > 0.1) {
        element.currentTime = sourceTimeSec

        // Wait for video to be ready
        if (element instanceof HTMLVideoElement) {
          promises.push(
            new Promise<void>((resolve) => {
              if (!element.seeking && element.readyState >= 2) {
                resolve()
                return
              }

              const done = () => {
                element.removeEventListener('seeked', done)
                element.removeEventListener('canplay', done)
                resolve()
              }

              element.addEventListener('seeked', done, { once: true })
              element.addEventListener('canplay', done, { once: true })

              // Timeout fallback
              setTimeout(done, 200)
            }),
          )
        }
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  /**
   * Start all active media elements
   */
  async function startMediaElements(timeMs: number) {
    const activeClips = getActiveClips(timeMs)
    const activeIds = new Set(activeClips.map((c) => c.clipId))
    const playPromises: Promise<void>[] = []

    // Start active elements
    for (const clip of activeClips) {
      if (clip.type === 'image') continue

      const element = mediaElements.get(clip.clipId)
      if (element && element.paused) {
        playPromises.push(element.play().catch(() => {}))
        playingClipIds.add(clip.clipId)
      }
    }

    // Wait for all play promises
    if (playPromises.length > 0) {
      await Promise.all(playPromises)
    }

    // Pause inactive elements
    for (const [clipId, element] of mediaElements) {
      if (!activeIds.has(clipId) && !element.paused) {
        element.pause()
      }
    }
  }

  /**
   * Start playback
   */
  async function play() {
    if (isPlaying.value) return

    // Cancel any existing frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    ensureCompositor()

    // Reset to start if at end
    if (state.currentTime >= state.duration) {
      setCurrentTime(0)
    }

    // Sync videos to current position
    await syncVideosToTime(state.currentTime)

    // Start media elements
    await startMediaElements(state.currentTime)

    // Small delay to let videos actually start
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Record start time for smooth playback
    playStartTime = performance.now()
    playStartPosition = state.currentTime

    isPlaying.value = true
    setIsPlaying(true)

    // Start render loop
    animationFrameId = requestAnimationFrame(renderLoop)
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

    // Pause all media
    for (const element of mediaElements.values()) {
      if (!element.paused) {
        element.pause()
      }
    }

    // Clear playing state
    playingClipIds.clear()
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
  async function seek(timeMs: number) {
    const clampedTime = Math.max(0, Math.min(timeMs, state.duration))
    const wasPlaying = isPlaying.value

    // Stop if playing
    if (wasPlaying) {
      pause()
    }

    // Update timeline
    setCurrentTime(clampedTime)

    // Sync videos
    await syncVideosToTime(clampedTime)

    // Update display
    updateCompositorVisibility(clampedTime)

    // Resume if was playing
    if (wasPlaying) {
      await play()
    }
  }

  /**
   * Stop and reset
   */
  function stop() {
    pause()
    setCurrentTime(0)
  }

  /**
   * Register a media element
   */
  function registerMediaElement(clipId: string, element: HTMLVideoElement | HTMLAudioElement) {
    element.pause()
    mediaElements.set(clipId, element)

    ensureCompositor()

    if (element instanceof HTMLVideoElement) {
      const clip = state.clips.find((c) => c.id === clipId)
      if (clip) {
        compositor?.setLayer(clipId, clip.trackId, element)
      }
    }

    // Render to show the clip
    updateCompositorVisibility(state.currentTime)
  }

  /**
   * Register an image element
   */
  function registerImageElement(clipId: string, element: HTMLImageElement) {
    ensureCompositor()

    const clip = state.clips.find((c) => c.id === clipId)
    if (clip) {
      compositor?.setLayer(clipId, clip.trackId, element)
    }

    updateCompositorVisibility(state.currentTime)
  }

  /**
   * Unregister a media element
   */
  function unregisterMediaElement(clipId: string) {
    const element = mediaElements.get(clipId)
    if (element) {
      element.pause()
    }
    mediaElements.delete(clipId)
    compositor?.removeLayer(clipId)
  }

  /**
   * Unregister an image element
   */
  function unregisterImageElement(clipId: string) {
    compositor?.removeLayer(clipId)
  }

  /**
   * Initialize compositor
   */
  async function initCompositor(container: HTMLElement) {
    ensureCompositor()
    await compositor?.init(container)
  }

  /**
   * Resize compositor
   */
  function resizeCompositor(width: number, height: number) {
    compositor?.resize(width, height)
  }

  /**
   * Render current frame (for static preview)
   */
  async function renderCurrentFrame() {
    if (isPlaying.value) return

    ensureCompositor()
    await syncVideosToTime(state.currentTime)
    updateCompositorVisibility(state.currentTime)
  }

  return {
    // State
    isPlaying: readonly(isPlaying),

    // Playback
    play,
    pause,
    togglePlayback,
    seek,
    stop,

    // Media management
    registerMediaElement,
    registerImageElement,
    unregisterMediaElement,
    unregisterImageElement,

    // Compositor
    initCompositor,
    resizeCompositor,

    // Utilities
    getActiveClips,
    getActiveVisualClips,
    getActiveAudioClips,
    getSourceTime,
    renderCurrentFrame,
  }
}
