import type { Track, Clip, Dimensions } from './project'

// Media types
export type MediaType = 'video' | 'audio' | 'image'

// Media file loaded in browser (client-side)
export interface MediaFile {
  id: string
  file: File
  name: string
  type: MediaType
  mimeType: string
  size: number
  duration: number // in ms, -1 for images
  dimensions?: Dimensions // for video/image
  url: string // blob URL for preview
  thumbnail?: string // blob URL for thumbnail
}

// Editor state
export interface EditorState {
  projectId: string | null
  projectName: string
  tracks: Track[]
  clips: Clip[]
  mediaFiles: MediaFile[]
  selectedClipId: string | null
  currentTime: number
  duration: number
  zoom: number
  isPlaying: boolean
  resolution: Dimensions
  frameRate: number
}

// Drag & Drop
export interface DragData {
  type: 'media' | 'clip'
  id: string
}

export interface DropPosition {
  trackId: string
  timelineStart: number
}

// Timeline
export interface TimelineConfig {
  pixelsPerSecond: number
  trackHeight: number
  minZoom: number
  maxZoom: number
}
