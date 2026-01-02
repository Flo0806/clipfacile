/**
 * Compositor Engine (Canvas 2D)
 *
 * Canvas 2D-based compositing engine for real-time video preview.
 * Handles layer compositing, transparency, and basic effects.
 *
 * Design notes:
 * - All visual effects must map to FFmpeg filters for server-side rendering
 * - Tracks are rendered bottom-to-top (lower track order = behind)
 * - Videos/images are drawn with drawImage() each frame
 * - CSS filters on canvas can simulate blur/glow for preview
 */

export interface CompositorLayer {
  clipId: string
  trackId: string
  trackOrder: number
  sourceId: string
  type: 'video' | 'image'
  element: HTMLVideoElement | HTMLImageElement
  // Transform properties
  opacity: number
  visible: boolean
}

export interface CompositorOptions {
  width: number
  height: number
  backgroundColor: string
}

// Singleton state
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
const layers = new Map<string, CompositorLayer>()
let isInitialized = false

// Animation frame for render loop
let renderLoopId: number | null = null
let isRendering = false

export function useCompositor() {
  const { state } = useEditorState()

  /**
   * Initialize the Canvas 2D compositor
   */
  async function init(container: HTMLElement, options?: Partial<CompositorOptions>) {
    if (isInitialized && canvas) {
      // Already initialized, just move canvas to new container
      if (canvas.parentElement !== container) {
        container.appendChild(canvas)
      }
      resize(container.clientWidth, container.clientHeight)
      return
    }

    const width = options?.width ?? container.clientWidth ?? 1920
    const height = options?.height ?? container.clientHeight ?? 1080

    // Create canvas element
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.objectFit = 'contain'
    canvas.style.backgroundColor = options?.backgroundColor ?? '#000000'

    // Get 2D context
    ctx = canvas.getContext('2d', {
      alpha: false, // Opaque canvas for better performance
      desynchronized: true, // Reduce latency
    })

    if (!ctx) {
      console.error('Failed to get 2D context')
      return
    }

    container.appendChild(canvas)
    isInitialized = true

    // Initial render
    render()
  }

  /**
   * Resize the compositor canvas
   */
  function resize(width: number, height: number) {
    if (!canvas || !ctx) return

    canvas.width = width
    canvas.height = height

    // Re-render after resize
    render()
  }

  /**
   * Fit source dimensions to stage while maintaining aspect ratio (contain)
   */
  function fitToStage(
    sourceWidth: number,
    sourceHeight: number,
    stageWidth: number,
    stageHeight: number,
  ): { x: number, y: number, width: number, height: number } {
    if (sourceWidth === 0 || sourceHeight === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    const scaleX = stageWidth / sourceWidth
    const scaleY = stageHeight / sourceHeight
    const scale = Math.min(scaleX, scaleY)

    const width = sourceWidth * scale
    const height = sourceHeight * scale
    const x = (stageWidth - width) / 2
    const y = (stageHeight - height) / 2

    return { x, y, width, height }
  }

  /**
   * Add or update a layer
   */
  function setLayer(clipId: string, trackId: string, element: HTMLVideoElement | HTMLImageElement) {
    const track = state.tracks.find((t) => t.id === trackId)
    const trackOrder = track?.order ?? 0
    const isVideo = element instanceof HTMLVideoElement

    // Check if layer already exists
    const existingLayer = layers.get(clipId)

    if (existingLayer) {
      // Update existing layer
      existingLayer.element = element
      existingLayer.trackOrder = trackOrder
      return
    }

    // Create new layer
    const layer: CompositorLayer = {
      clipId,
      trackId,
      trackOrder,
      sourceId: '',
      type: isVideo ? 'video' : 'image',
      element,
      opacity: 1,
      visible: true,
    }

    layers.set(clipId, layer)
  }

  /**
   * Remove a layer
   */
  function removeLayer(clipId: string) {
    layers.delete(clipId)
  }

  /**
   * Show/hide a layer
   */
  function setLayerVisible(clipId: string, visible: boolean) {
    const layer = layers.get(clipId)
    if (layer) {
      layer.visible = visible
    }
  }

  /**
   * Set layer opacity (0-1)
   */
  function setLayerOpacity(clipId: string, opacity: number) {
    const layer = layers.get(clipId)
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity))
    }
  }

  /**
   * Get all current layer IDs
   */
  function getLayerIds(): string[] {
    return Array.from(layers.keys())
  }

  /**
   * Clear all layers
   */
  function clearLayers() {
    layers.clear()
  }

  /**
   * Render a single frame
   */
  function render() {
    if (!canvas || !ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas with black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    // Sort layers by track order (lower = behind, higher = in front)
    const sortedLayers = Array.from(layers.values())
      .filter((layer) => layer.visible)
      .sort((a, b) => a.trackOrder - b.trackOrder)

    // Draw each layer
    for (const layer of sortedLayers) {
      const element = layer.element

      // Get source dimensions
      let sourceWidth: number
      let sourceHeight: number

      if (element instanceof HTMLVideoElement) {
        // Skip if video is not ready
        if (element.readyState < 2 || element.videoWidth === 0) {
          continue
        }
        sourceWidth = element.videoWidth
        sourceHeight = element.videoHeight
      } else {
        // Image
        if (!element.complete || element.naturalWidth === 0) {
          continue
        }
        sourceWidth = element.naturalWidth
        sourceHeight = element.naturalHeight
      }

      // Calculate fit position
      const fit = fitToStage(sourceWidth, sourceHeight, width, height)

      // Apply opacity
      ctx.globalAlpha = layer.opacity

      // Draw the element
      try {
        ctx.drawImage(element, fit.x, fit.y, fit.width, fit.height)
      } catch {
        // Drawing failed - element might not be ready
      }

      // Reset alpha
      ctx.globalAlpha = 1
    }
  }

  /**
   * Start continuous render loop (for playback)
   */
  function startRenderLoop() {
    if (isRendering) return

    isRendering = true

    const loop = () => {
      if (!isRendering) return
      render()
      renderLoopId = requestAnimationFrame(loop)
    }

    renderLoopId = requestAnimationFrame(loop)
  }

  /**
   * Stop continuous render loop
   */
  function stopRenderLoop() {
    isRendering = false
    if (renderLoopId !== null) {
      cancelAnimationFrame(renderLoopId)
      renderLoopId = null
    }
  }

  /**
   * Destroy the compositor
   */
  function destroy() {
    stopRenderLoop()
    clearLayers()

    if (canvas && canvas.parentElement) {
      canvas.parentElement.removeChild(canvas)
    }

    canvas = null
    ctx = null
    isInitialized = false
  }

  return {
    // Lifecycle
    init,
    destroy,
    resize,

    // Layer management
    setLayer,
    removeLayer,
    setLayerVisible,
    setLayerOpacity,
    getLayerIds,
    clearLayers,

    // Rendering
    render,
    startRenderLoop,
    stopRenderLoop,

    // State
    isInitialized: computed(() => isInitialized),
  }
}
