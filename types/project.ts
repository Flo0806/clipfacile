import type { Types } from 'mongoose'

// Track types
export type TrackType = 'video' | 'audio' | 'text'

// Base interfaces
export interface TimeRange {
  start: number // in milliseconds
  end: number
}

export interface Position {
  x: number
  y: number
}

export interface Dimensions {
  width: number
  height: number
}

// Clip types
export interface ClipBase {
  id: string
  trackId: string
  timelineStart: number // position on timeline in ms
  duration: number
  sourceStart?: number // start position in source file
  sourceEnd?: number
}

export interface VideoClip extends ClipBase {
  type: 'video'
  sourceId: string // reference to uploaded file
  volume: number // 0-1
  muted: boolean
  position?: Position
  scale?: number
  rotation?: number
  opacity?: number
}

export interface AudioClip extends ClipBase {
  type: 'audio'
  sourceId: string
  volume: number
  fadeIn?: number
  fadeOut?: number
}

export interface TextClip extends ClipBase {
  type: 'text'
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  backgroundColor?: string
  position: Position
  alignment: 'left' | 'center' | 'right'
  animation?: TextAnimation
}

export type Clip = VideoClip | AudioClip | TextClip

// Animations & Effects
export interface TextAnimation {
  type: 'fade' | 'slide' | 'typewriter' | 'none'
  duration: number
}

export interface Effect {
  id: string
  clipId: string
  type: EffectType
  params: Record<string, number | string | boolean>
}

export type EffectType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur'
  | 'grayscale'
  | 'sepia'

// Transitions
export interface Transition {
  id: string
  clipId: string // clip that starts after transition
  type: TransitionType
  duration: number
}

export type TransitionType =
  | 'fade'
  | 'dissolve'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'

// Track
export interface Track {
  id: string
  type: TrackType
  name: string
  order: number
  muted: boolean
  locked: boolean
}

// Media source (uploaded files)
export interface MediaSource {
  id: string
  projectId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  duration?: number // for video/audio
  dimensions?: Dimensions // for video/image
  uploadedAt: Date
}

// Project
export interface Project {
  _id?: Types.ObjectId
  name: string
  description?: string
  resolution: Dimensions
  frameRate: number
  duration: number
  tracks: Track[]
  clips: Clip[]
  transitions: Transition[]
  effects: Effect[]
  createdAt: Date
  updatedAt: Date
}

// API request/response types
export interface CreateProjectRequest {
  name: string
  description?: string
  resolution?: Dimensions
  frameRate?: number
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  tracks?: Track[]
  clips?: Clip[]
  transitions?: Transition[]
  effects?: Effect[]
}

// Export settings
export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov'
  resolution: Dimensions
  frameRate: number
  videoBitrate: number
  audioBitrate: number
  quality: 'low' | 'medium' | 'high' | 'ultra'
}
