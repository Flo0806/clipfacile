import type { Track, Clip, VideoClip, AudioClip, TrackType, Dimensions } from '../../shared/types/project'
import type { MediaFile, EditorState } from '../../shared/types/editor'

const DEFAULT_IMAGE_DURATION = 5000 // 5 seconds default for images

// Track limits per type
const MAX_TRACKS_PER_TYPE = 10

// Autosave debounce time
const AUTOSAVE_DELAY = 3000

export const useEditorStore = defineStore('editor', () => {
  // State
  const projectId = ref<string | null>(null)
  const projectName = ref('Unbenannt')
  const tracks = ref<Track[]>([])
  const clips = ref<Clip[]>([])
  const mediaFiles = ref<MediaFile[]>([])
  const selectedClipId = ref<string | null>(null)
  const currentTime = ref(0)
  const duration = ref(0)
  const zoom = ref(1)
  const isPlaying = ref(false)
  const resolution = ref<Dimensions>({ width: 1920, height: 1080 })
  const frameRate = ref(30)

  // Autosave state
  const isSaving = ref(false)
  const lastSaved = ref<Date | null>(null)
  const hasUnsavedChanges = ref(false)
  let autosaveTimeout: ReturnType<typeof setTimeout> | null = null

  // Computed state object for convenient access
  const state = computed<EditorState>(() => ({
    projectId: projectId.value,
    projectName: projectName.value,
    tracks: tracks.value,
    clips: clips.value,
    mediaFiles: mediaFiles.value,
    selectedClipId: selectedClipId.value,
    currentTime: currentTime.value,
    duration: duration.value,
    zoom: zoom.value,
    isPlaying: isPlaying.value,
    resolution: resolution.value,
    frameRate: frameRate.value,
  }))

  // Getters
  function getClipsForTrack(trackId: string): Clip[] {
    return clips.value.filter((c) => c.trackId === trackId)
  }

  function getMediaFile(id: string): MediaFile | undefined {
    return mediaFiles.value.find((m) => m.id === id)
  }

  // Actions
  function initializeProject() {
    projectId.value = null
    projectName.value = 'Unbenannt'
    tracks.value = [
      { id: 'video-1', type: 'video', name: 'Video 1', order: 0, muted: false, locked: false },
      { id: 'audio-1', type: 'audio', name: 'Audio 1', order: 1, muted: false, locked: false },
      { id: 'text-1', type: 'text', name: 'Text 1', order: 2, muted: false, locked: false },
    ]
    clips.value = []
    mediaFiles.value = []
    selectedClipId.value = null
    currentTime.value = 0
    duration.value = 0
    isPlaying.value = false
  }

  async function addMediaFile(file: File): Promise<MediaFile> {
    const id = crypto.randomUUID()
    const url = URL.createObjectURL(file)
    const type = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'image'

    const mediaFile = await new Promise<MediaFile>((resolve, reject) => {
      if (type === 'image') {
        const img = new Image()
        img.onload = () => {
          resolve({
            id,
            file,
            name: file.name,
            type,
            mimeType: file.type,
            size: file.size,
            duration: -1,
            dimensions: { width: img.width, height: img.height },
            url,
          })
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = url
      } else {
        const element = document.createElement(type === 'video' ? 'video' : 'audio')
        element.src = url
        element.onloadedmetadata = () => {
          resolve({
            id,
            file,
            name: file.name,
            type,
            mimeType: file.type,
            size: file.size,
            duration: element.duration * 1000,
            dimensions: type === 'video'
              ? { width: (element as HTMLVideoElement).videoWidth, height: (element as HTMLVideoElement).videoHeight }
              : undefined,
            url,
          })
        }
        element.onerror = () => reject(new Error('Failed to load media'))
      }
    })

    mediaFiles.value.push(mediaFile)
    return mediaFile
  }

  function hasCollision(trackId: string, start: number, clipDuration: number, excludeClipId: string | null): boolean {
    const end = start + clipDuration
    return clips.value.some((clip) => {
      if (clip.trackId !== trackId) return false
      if (excludeClipId && clip.id === excludeClipId) return false
      const clipEnd = clip.timelineStart + clip.duration
      return start < clipEnd && end > clip.timelineStart
    })
  }

  function addClip(mediaFileId: string, trackId: string, timelineStart: number): Clip | null {
    const mediaFile = mediaFiles.value.find((m) => m.id === mediaFileId)
    if (!mediaFile) return null

    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) return null

    const clipType = mediaFile.type === 'video' || mediaFile.type === 'image' ? 'video' : 'audio'

    if (track.type !== clipType) return null

    const clipDuration = mediaFile.duration === -1 ? DEFAULT_IMAGE_DURATION : mediaFile.duration

    if (hasCollision(trackId, timelineStart, clipDuration, null)) return null

    const clip: VideoClip | AudioClip = {
      id: crypto.randomUUID(),
      type: clipType,
      trackId,
      sourceId: mediaFile.id,
      timelineStart: Math.max(0, timelineStart),
      duration: clipDuration,
      sourceStart: 0,
      sourceEnd: clipDuration,
      volume: 1,
      muted: false,
    }

    clips.value.push(clip)
    updateDuration()
    scheduleAutosave()
    return clip
  }

  function moveClip(clipId: string, newTrackId: string, newTimelineStart: number): boolean {
    const clipIndex = clips.value.findIndex((c) => c.id === clipId)
    if (clipIndex === -1) return false

    const clip = clips.value[clipIndex]
    const track = tracks.value.find((t) => t.id === newTrackId)
    if (!track || !clip) return false

    if (track.type !== clip.type) return false

    if (hasCollision(newTrackId, newTimelineStart, clip.duration, clipId)) return false

    clips.value[clipIndex] = {
      ...clip,
      trackId: newTrackId,
      timelineStart: Math.max(0, newTimelineStart),
    }
    updateDuration()
    scheduleAutosave()
    return true
  }

  function removeClip(clipId: string) {
    const index = clips.value.findIndex((c) => c.id === clipId)
    if (index !== -1) {
      clips.value.splice(index, 1)
      if (selectedClipId.value === clipId) {
        selectedClipId.value = null
      }
      updateDuration()
      scheduleAutosave()
    }
  }

  /**
   * Resize a clip from left or right edge
   * @param clipId - The clip to resize
   * @param edge - Which edge is being dragged ('left' or 'right')
   * @param newEdgeTimeMs - The new position of that edge in timeline ms
   * @returns true if resize was successful
   */
  function resizeClip(clipId: string, edge: 'left' | 'right', newEdgeTimeMs: number): boolean {
    const clipIndex = clips.value.findIndex((c) => c.id === clipId)
    if (clipIndex === -1) return false

    const clip = clips.value[clipIndex]
    if (!clip) return false

    const mediaFile = mediaFiles.value.find((m) => m.id === (clip as VideoClip | AudioClip).sourceId)
    const sourceDuration = mediaFile?.duration ?? -1
    const isUnlimited = sourceDuration === -1 // Images have unlimited duration

    const currentStart = clip.timelineStart
    const currentSourceStart = clip.sourceStart ?? 0

    let newTimelineStart = currentStart
    let newDuration = clip.duration
    let newSourceStart = currentSourceStart
    let newSourceEnd = currentSourceStart + clip.duration

    const MIN_CLIP_DURATION = 100 // Minimum 100ms

    if (edge === 'right') {
      // Right edge: change duration and sourceEnd
      newDuration = Math.max(MIN_CLIP_DURATION, newEdgeTimeMs - currentStart)

      if (!isUnlimited) {
        // For video/audio: can't extend beyond source duration
        const maxDuration = sourceDuration - currentSourceStart
        newDuration = Math.min(newDuration, maxDuration)
      }

      newSourceEnd = currentSourceStart + newDuration
    } else {
      // Left edge: change timelineStart, duration, and sourceStart
      const newStart = Math.max(0, newEdgeTimeMs)
      const deltaMs = currentStart - newStart // positive when moving left

      if (!isUnlimited) {
        // For video/audio: can't extend sourceStart below 0
        const maxLeftMove = currentSourceStart
        const actualDelta = Math.min(deltaMs, maxLeftMove)

        // Also check if we're shrinking (moving right)
        if (deltaMs < 0) {
          // Moving right (shrinking from left)
          const maxShrink = clip.duration - MIN_CLIP_DURATION
          const actualShrink = Math.min(-deltaMs, maxShrink)
          newTimelineStart = currentStart + actualShrink
          newDuration = clip.duration - actualShrink
          newSourceStart = currentSourceStart + actualShrink
        } else {
          // Moving left (extending)
          newTimelineStart = currentStart - actualDelta
          newDuration = clip.duration + actualDelta
          newSourceStart = currentSourceStart - actualDelta
        }
      } else {
        // For images: unlimited extension, but can still shrink
        if (deltaMs < 0) {
          // Moving right (shrinking)
          const maxShrink = clip.duration - MIN_CLIP_DURATION
          const actualShrink = Math.min(-deltaMs, maxShrink)
          newTimelineStart = currentStart + actualShrink
          newDuration = clip.duration - actualShrink
        } else {
          // Moving left (extending)
          newTimelineStart = newStart
          newDuration = clip.duration + deltaMs
        }
        newSourceStart = 0
      }

      newSourceEnd = newSourceStart + newDuration
    }

    // Check for collision with new dimensions
    if (hasCollision(clip.trackId, newTimelineStart, newDuration, clipId)) {
      return false
    }

    // Apply changes
    clips.value[clipIndex] = {
      ...clip,
      timelineStart: newTimelineStart,
      duration: newDuration,
      sourceStart: newSourceStart,
      sourceEnd: newSourceEnd,
    }

    updateDuration()
    scheduleAutosave()
    return true
  }

  function addTrack(type: TrackType): Track | null {
    const existingCount = tracks.value.filter((t) => t.type === type).length

    // Check limit
    if (existingCount >= MAX_TRACKS_PER_TYPE) {
      return null
    }

    const typeName = type.charAt(0).toUpperCase() + type.slice(1)
    const newTrack: Track = {
      id: crypto.randomUUID(),
      type,
      name: `${typeName} ${existingCount + 1}`,
      order: tracks.value.length,
      muted: false,
      locked: false,
    }
    tracks.value.push(newTrack)
    sortTracks()
    scheduleAutosave()
    return newTrack
  }

  function removeTrack(trackId: string): { success: boolean, hadClips: boolean } {
    const trackIndex = tracks.value.findIndex((t) => t.id === trackId)
    if (trackIndex === -1) {
      return { success: false, hadClips: false }
    }

    // Check if track has clips
    const trackClips = clips.value.filter((c) => c.trackId === trackId)
    const hadClips = trackClips.length > 0

    // Remove all clips on this track
    if (hadClips) {
      clips.value = clips.value.filter((c) => c.trackId !== trackId)
      if (selectedClipId.value && trackClips.some((c) => c.id === selectedClipId.value)) {
        selectedClipId.value = null
      }
    }

    // Remove the track
    tracks.value.splice(trackIndex, 1)

    // Renumber tracks of same type
    renumberTracks()
    updateDuration()
    scheduleAutosave()

    return { success: true, hadClips }
  }

  function canAddTrack(type: TrackType): boolean {
    return tracks.value.filter((t) => t.type === type).length < MAX_TRACKS_PER_TYPE
  }

  function sortTracks() {
    // Sort: video first, then audio, then text
    const typeOrder: Record<TrackType, number> = { video: 0, audio: 1, text: 2 }
    tracks.value.sort((a, b) => {
      if (a.type !== b.type) {
        return typeOrder[a.type] - typeOrder[b.type]
      }
      return a.order - b.order
    })
    // Update order values
    tracks.value.forEach((t, i) => t.order = i)
  }

  function renumberTracks() {
    // Renumber tracks of each type
    const types: TrackType[] = ['video', 'audio', 'text']
    for (const type of types) {
      const typeTracks = tracks.value.filter((t) => t.type === type)
      const typeName = type.charAt(0).toUpperCase() + type.slice(1)
      typeTracks.forEach((t, i) => {
        t.name = `${typeName} ${i + 1}`
      })
    }
    sortTracks()
  }

  function selectClip(clipId: string | null) {
    selectedClipId.value = clipId
  }

  function setCurrentTime(timeMs: number) {
    currentTime.value = Math.max(0, timeMs)
  }

  function setIsPlaying(playing: boolean) {
    isPlaying.value = playing
  }

  function updateDuration() {
    if (clips.value.length === 0) {
      duration.value = 0
      return
    }
    duration.value = Math.max(...clips.value.map((c) => c.timelineStart + c.duration))
  }

  // Zoom controls
  const MIN_ZOOM = 0.1
  const MAX_ZOOM = 5
  const ZOOM_STEP = 0.25

  function zoomIn() {
    zoom.value = Math.min(MAX_ZOOM, zoom.value + ZOOM_STEP)
  }

  function zoomOut() {
    zoom.value = Math.max(MIN_ZOOM, zoom.value - ZOOM_STEP)
  }

  function setZoom(value: number) {
    zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
  }

  // Snap helper
  function snapToMarker(timeMs: number, pixelsPerMs: number): { time: number, snapped: boolean } {
    const SNAP_THRESHOLD_PX = 10
    const snapThresholdMs = SNAP_THRESHOLD_PX / pixelsPerMs

    const targetPixels = 80
    const intervals = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000, 300000] as const
    let markerInterval: number = 300000
    for (const interval of intervals) {
      if (interval * pixelsPerMs >= targetPixels) {
        markerInterval = interval
        break
      }
    }

    const nearestMarker = Math.round(timeMs / markerInterval) * markerInterval
    const distance = Math.abs(timeMs - nearestMarker)

    if (distance <= snapThresholdMs) {
      return { time: nearestMarker, snapped: true }
    }
    return { time: timeMs, snapped: false }
  }

  // ========== Project Persistence ==========

  /**
   * Create a new project on the server
   */
  async function createProject(name?: string): Promise<string> {
    const response = await $fetch<ProjectCreateResponse>('/api/projects', {
      method: 'POST',
      body: { name: name || 'Unbenannt' },
    })

    projectId.value = response.id
    projectName.value = response.name
    hasUnsavedChanges.value = false
    lastSaved.value = new Date()

    return response.id
  }

  /**
   * Load a project from the server
   */
  async function loadProject(id: string): Promise<void> {
    const response = await $fetch<ProjectResponse>(`/api/projects/${id}`)

    projectId.value = response.id
    projectName.value = response.name
    resolution.value = response.resolution
    frameRate.value = response.frameRate
    duration.value = response.duration
    tracks.value = response.tracks
    clips.value = response.clips
    selectedClipId.value = null
    currentTime.value = 0
    isPlaying.value = false
    hasUnsavedChanges.value = false
    lastSaved.value = new Date(response.updatedAt)

    // Reconstruct MediaFile objects and preload media via fetch (fills browser cache)
    const preloadPromises: Promise<MediaFile>[] = response.mediaFiles.map(async (stored) => {
      const url = `/api/media/${response.id}/${stored.filename}`

      // Fetch the entire file to cache it (must call .blob() to actually download body)
      try {
        const res = await fetch(url)
        await res.blob()
      } catch {
        // Ignore preload errors - file will be fetched when needed
      }

      return {
        id: stored.id,
        name: stored.name,
        type: stored.type,
        mimeType: stored.mimeType,
        size: stored.size,
        duration: stored.duration,
        dimensions: stored.dimensions,
        url,
      }
    })

    // Wait for all media to preload (caches in browser)
    mediaFiles.value = await Promise.all(preloadPromises)
  }

  /**
   * Save current project to server
   */
  async function saveProject(): Promise<void> {
    if (!projectId.value) {
      await createProject(projectName.value)
      return
    }

    isSaving.value = true
    try {
      const response = await $fetch<ProjectUpdateResponse>(`/api/projects/${projectId.value}`, {
        method: 'PATCH',
        body: {
          name: projectName.value,
          tracks: tracks.value,
          clips: clips.value,
          duration: duration.value,
        },
      })

      lastSaved.value = new Date(response.updatedAt)
      hasUnsavedChanges.value = false
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Schedule autosave (debounced)
   */
  function scheduleAutosave() {
    hasUnsavedChanges.value = true

    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout)
    }

    autosaveTimeout = setTimeout(() => {
      saveProject().catch(console.error)
    }, AUTOSAVE_DELAY)
  }

  /**
   * Update project name
   */
  function setProjectName(name: string) {
    projectName.value = name
    scheduleAutosave()
  }

  /**
   * Upload a media file to the server
   */
  async function uploadMediaFile(file: File): Promise<MediaFile> {
    // First, ensure we have a project
    if (!projectId.value) {
      await createProject()
    }

    // Upload to server
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<MediaUploadResponse>(`/api/projects/${projectId.value}/upload`, {
      method: 'POST',
      body: formData,
    })

    // Create local MediaFile with server URL
    const mediaFile = await new Promise<MediaFile>((resolve, reject) => {
      if (response.type === 'image') {
        const img = new Image()
        img.onload = () => {
          resolve({
            id: response.id,
            file,
            name: response.originalName,
            type: response.type,
            mimeType: response.mimeType,
            size: response.size,
            duration: -1,
            dimensions: { width: img.width, height: img.height },
            url: response.url,
          })
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = response.url
      } else {
        const element = document.createElement(response.type === 'video' ? 'video' : 'audio')
        element.src = response.url
        element.onloadedmetadata = () => {
          resolve({
            id: response.id,
            file,
            name: response.originalName,
            type: response.type,
            mimeType: response.mimeType,
            size: response.size,
            duration: element.duration * 1000,
            dimensions: response.type === 'video'
              ? { width: (element as HTMLVideoElement).videoWidth, height: (element as HTMLVideoElement).videoHeight }
              : undefined,
            url: response.url,
          })
        }
        element.onerror = () => reject(new Error('Failed to load media'))
      }
    })

    mediaFiles.value.push(mediaFile)
    return mediaFile
  }

  return {
    // State (readonly for external use)
    state,
    // Use computed instead of readonly to avoid SSR hydration warnings
    // Computed properties are naturally excluded from Pinia hydration
    projectId: computed(() => projectId.value),
    projectName: computed(() => projectName.value),
    tracks: computed(() => tracks.value),
    clips: computed(() => clips.value),
    mediaFiles: computed(() => mediaFiles.value),
    selectedClipId: computed(() => selectedClipId.value),
    currentTime: computed(() => currentTime.value),
    duration: computed(() => duration.value),
    zoom: computed(() => zoom.value),
    isPlaying: computed(() => isPlaying.value),
    resolution: computed(() => resolution.value),
    frameRate: computed(() => frameRate.value),

    // Getters
    getClipsForTrack,
    getMediaFile,

    // Actions
    initializeProject,
    addMediaFile,
    addClip,
    moveClip,
    removeClip,
    resizeClip,
    addTrack,
    removeTrack,
    canAddTrack,
    selectClip,
    setCurrentTime,
    setIsPlaying,
    hasCollision,
    zoomIn,
    zoomOut,
    setZoom,
    snapToMarker,

    // Project persistence
    createProject,
    loadProject,
    saveProject,
    setProjectName,
    uploadMediaFile,
    isSaving: computed(() => isSaving.value),
    lastSaved: computed(() => lastSaved.value),
    hasUnsavedChanges: computed(() => hasUnsavedChanges.value),
  }
})
