/**
 * Audio Mixer Engine
 *
 * Web Audio API-based audio mixing for real-time preview.
 * Handles volume control, fades, and mixing multiple audio sources.
 *
 * Design notes:
 * - All audio effects must map to FFmpeg audio filters for server-side rendering
 * - Each audio source gets its own GainNode for individual volume control
 * - Master output goes through a master GainNode
 * - Fade automation uses Web Audio's built-in scheduling
 */

export interface AudioSource {
  clipId: string
  element: HTMLVideoElement | HTMLAudioElement
  sourceNode: MediaElementAudioSourceNode
  gainNode: GainNode
  volume: number // Base volume (0-1)
  fadeIn?: number // Fade in duration in ms
  fadeOut?: number // Fade out duration in ms
}

export interface FadeConfig {
  fadeInMs?: number
  fadeOutMs?: number
}

// Singleton state
let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null
const audioSources = new Map<string, AudioSource>()
let isInitialized = false

export function useAudioMixer() {
  /**
   * Initialize the audio context
   */
  function init() {
    if (isInitialized && audioContext) return

    audioContext = new AudioContext()
    masterGain = audioContext.createGain()
    masterGain.connect(audioContext.destination)
    masterGain.gain.value = 1

    isInitialized = true

    // Connect any queued sources that were added before init
    for (const [clipId, source] of audioSources) {
      if (!source.sourceNode || !source.gainNode) {
        // This source was queued, now connect it
        try {
          const sourceNode = audioContext.createMediaElementSource(source.element)
          const gainNode = audioContext.createGain()

          sourceNode.connect(gainNode)
          gainNode.connect(masterGain!)
          gainNode.gain.value = source.volume

          source.sourceNode = sourceNode
          source.gainNode = gainNode
        } catch {
          // Element might already be connected to another context
          audioSources.delete(clipId)
        }
      }
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async function resume() {
    if (audioContext?.state === 'suspended') {
      await audioContext.resume()
    }
  }

  /**
   * Add an audio source (video or audio element)
   * Note: AudioContext will be created lazily on first user interaction
   */
  function addSource(
    clipId: string,
    element: HTMLVideoElement | HTMLAudioElement,
    volume: number = 1,
    fadeConfig?: FadeConfig,
  ) {
    // Don't create AudioContext here - wait for user interaction (play button)
    // Just store the element info for later connection
    if (!audioContext || !masterGain) {
      // Queue for later when context is initialized
      audioSources.set(clipId, {
        clipId,
        element,
        sourceNode: null as unknown as MediaElementAudioSourceNode,
        gainNode: null as unknown as GainNode,
        volume,
        fadeIn: fadeConfig?.fadeInMs,
        fadeOut: fadeConfig?.fadeOutMs,
      })
      return
    }

    // Check if source already exists
    if (audioSources.has(clipId)) {
      const existingSource = audioSources.get(clipId)!

      // If it's the same element, just update volume
      if (existingSource.element === element) {
        existingSource.volume = volume
        existingSource.fadeIn = fadeConfig?.fadeInMs
        existingSource.fadeOut = fadeConfig?.fadeOutMs
        existingSource.gainNode.gain.value = volume
        return
      }

      // Different element (was recreated) - remove old source first
      removeSource(clipId)
    }

    // Create new source
    const sourceNode = audioContext!.createMediaElementSource(element)
    const gainNode = audioContext!.createGain()

    sourceNode.connect(gainNode)
    gainNode.connect(masterGain!)
    gainNode.gain.value = volume

    audioSources.set(clipId, {
      clipId,
      element,
      sourceNode,
      gainNode,
      volume,
      fadeIn: fadeConfig?.fadeInMs,
      fadeOut: fadeConfig?.fadeOutMs,
    })
  }

  /**
   * Remove an audio source
   */
  function removeSource(clipId: string) {
    const source = audioSources.get(clipId)
    if (source) {
      // Only disconnect if nodes were created (not queued)
      if (source.gainNode) {
        try {
          source.gainNode.disconnect()
        } catch {
          // Already disconnected
        }
      }
      if (source.sourceNode) {
        try {
          source.sourceNode.disconnect()
        } catch {
          // Already disconnected
        }
      }
      audioSources.delete(clipId)
    }
  }

  /**
   * Set volume for a source (0-1)
   */
  function setSourceVolume(clipId: string, volume: number) {
    const source = audioSources.get(clipId)
    if (source) {
      source.volume = Math.max(0, Math.min(1, volume))
      // Only set gain if node exists (not queued)
      if (source.gainNode) {
        source.gainNode.gain.value = source.volume
      }
    }
  }

  /**
   * Configure fade for a source
   */
  function setSourceFade(clipId: string, fadeConfig: FadeConfig) {
    const source = audioSources.get(clipId)
    if (source) {
      source.fadeIn = fadeConfig.fadeInMs
      source.fadeOut = fadeConfig.fadeOutMs
    }
  }

  /**
   * Apply fade in effect
   */
  function applyFadeIn(clipId: string, durationMs?: number) {
    const source = audioSources.get(clipId)
    if (!source || !audioContext) return

    const duration = durationMs ?? source.fadeIn ?? 0
    if (duration <= 0) {
      source.gainNode.gain.value = source.volume
      return
    }

    const now = audioContext.currentTime
    const durationSec = duration / 1000

    source.gainNode.gain.cancelScheduledValues(now)
    source.gainNode.gain.setValueAtTime(0, now)
    source.gainNode.gain.linearRampToValueAtTime(source.volume, now + durationSec)
  }

  /**
   * Apply fade out effect
   */
  function applyFadeOut(clipId: string, durationMs?: number) {
    const source = audioSources.get(clipId)
    if (!source || !audioContext) return

    const duration = durationMs ?? source.fadeOut ?? 0
    if (duration <= 0) {
      source.gainNode.gain.value = 0
      return
    }

    const now = audioContext.currentTime
    const durationSec = duration / 1000

    source.gainNode.gain.cancelScheduledValues(now)
    source.gainNode.gain.setValueAtTime(source.gainNode.gain.value, now)
    source.gainNode.gain.linearRampToValueAtTime(0, now + durationSec)
  }

  /**
   * Update source based on playback position within clip
   * Call this each frame to handle fade automation
   */
  function updateSourceForPosition(
    clipId: string,
    positionInClipMs: number,
    clipDurationMs: number,
  ) {
    const source = audioSources.get(clipId)
    if (!source) return

    const fadeIn = source.fadeIn ?? 0
    const fadeOut = source.fadeOut ?? 0

    let targetGain = source.volume

    // Apply fade in
    if (fadeIn > 0 && positionInClipMs < fadeIn) {
      targetGain = (positionInClipMs / fadeIn) * source.volume
    }

    // Apply fade out
    const fadeOutStart = clipDurationMs - fadeOut
    if (fadeOut > 0 && positionInClipMs > fadeOutStart) {
      const fadeOutProgress = (positionInClipMs - fadeOutStart) / fadeOut
      targetGain = (1 - fadeOutProgress) * source.volume
    }

    // Smooth gain change to avoid clicks
    if (source.gainNode && audioContext) {
      const now = audioContext.currentTime
      source.gainNode.gain.cancelScheduledValues(now)
      source.gainNode.gain.setTargetAtTime(targetGain, now, 0.01)
    }
  }

  /**
   * Set master volume (0-1)
   */
  function setMasterVolume(volume: number) {
    if (masterGain) {
      masterGain.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Get master volume
   */
  function getMasterVolume(): number {
    return masterGain?.gain.value ?? 1
  }

  /**
   * Mute/unmute a source
   */
  function muteSource(clipId: string, muted: boolean) {
    const source = audioSources.get(clipId)
    if (source) {
      source.gainNode.gain.value = muted ? 0 : source.volume
    }
  }

  /**
   * Mute/unmute master output
   */
  function muteMaster(muted: boolean) {
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : 1
    }
  }

  /**
   * Check if a source exists
   */
  function hasSource(clipId: string): boolean {
    return audioSources.has(clipId)
  }

  /**
   * Get all source IDs
   */
  function getSourceIds(): string[] {
    return Array.from(audioSources.keys())
  }

  /**
   * Clear all sources
   */
  function clearSources() {
    for (const clipId of audioSources.keys()) {
      removeSource(clipId)
    }
  }

  /**
   * Destroy the audio mixer
   */
  function destroy() {
    clearSources()

    if (audioContext) {
      audioContext.close()
      audioContext = null
    }

    masterGain = null
    isInitialized = false
  }

  return {
    // Lifecycle
    init,
    resume,
    destroy,

    // Source management
    addSource,
    removeSource,
    hasSource,
    getSourceIds,
    clearSources,

    // Volume control
    setSourceVolume,
    setMasterVolume,
    getMasterVolume,
    muteSource,
    muteMaster,

    // Fade effects
    setSourceFade,
    applyFadeIn,
    applyFadeOut,
    updateSourceForPosition,

    // State
    isInitialized: computed(() => isInitialized),
  }
}
