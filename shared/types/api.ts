import type { Track, Clip, Transition, Effect, Dimensions, StoredMediaFile } from './project'

// Project API responses
export interface ProjectCreateResponse {
  id: string
  name: string
}

export interface ProjectResponse {
  id: string
  name: string
  description?: string
  resolution: Dimensions
  frameRate: number
  duration: number
  tracks: Track[]
  clips: Clip[]
  transitions: Transition[]
  effects: Effect[]
  mediaFiles: StoredMediaFile[]
  createdAt: Date
  updatedAt: Date
}

export interface ProjectUpdateResponse {
  id: string
  updatedAt: Date
}

// Project API requests
export interface ProjectUpdateRequest {
  name?: string
  tracks?: Track[]
  clips?: Clip[]
  duration?: number
  transitions?: Transition[]
  effects?: Effect[]
}

// Project list item (lighter than full ProjectResponse)
export interface ProjectListItem {
  id: string
  name: string
  duration: number
  clipCount: number
  createdAt: Date
  updatedAt: Date
}

// Media upload response
export interface MediaUploadResponse {
  id: string
  filename: string
  originalName: string
  type: 'video' | 'audio' | 'image'
  mimeType: string
  size: number
  url: string
}
