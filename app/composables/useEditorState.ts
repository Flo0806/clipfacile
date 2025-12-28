// Thin wrapper around the editor store for convenience
// Components can use either useEditorState() or useEditorStore() directly

export function useEditorState() {
  const store = useEditorStore()

  // Create a reactive wrapper that auto-unwraps the computed state
  const state = reactive({
    get projectId() {
      return store.state.projectId
    },
    get projectName() {
      return store.state.projectName
    },
    get tracks() {
      return store.state.tracks
    },
    get clips() {
      return store.state.clips
    },
    get mediaFiles() {
      return store.state.mediaFiles
    },
    get selectedClipId() {
      return store.state.selectedClipId
    },
    get currentTime() {
      return store.state.currentTime
    },
    get duration() {
      return store.state.duration
    },
    get zoom() {
      return store.state.zoom
    },
    get isPlaying() {
      return store.state.isPlaying
    },
    get resolution() {
      return store.state.resolution
    },
    get frameRate() {
      return store.state.frameRate
    },
  })

  return {
    // Expose state as a reactive object for template access
    state,

    // Actions
    initializeProject: store.initializeProject,
    addMediaFile: store.addMediaFile,
    addClip: store.addClip,
    moveClip: store.moveClip,
    removeClip: store.removeClip,
    addTrack: store.addTrack,
    selectClip: store.selectClip,
    hasCollision: store.hasCollision,
    zoomIn: store.zoomIn,
    zoomOut: store.zoomOut,
    setZoom: store.setZoom,
    snapToMarker: store.snapToMarker,

    // Getters
    getClipsForTrack: store.getClipsForTrack,
    getMediaFile: store.getMediaFile,
  }
}
