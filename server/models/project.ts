import mongoose, { Schema } from 'mongoose'
import type { Project } from '../../types/project'

const TrackSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['video', 'audio', 'text'], required: true },
  name: { type: String, required: true },
  order: { type: Number, required: true },
  muted: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
}, { _id: false })

const ClipSchema = new Schema({
  id: { type: String, required: true },
  trackId: { type: String, required: true },
  type: { type: String, enum: ['video', 'audio', 'text'], required: true },
  timelineStart: { type: Number, required: true },
  duration: { type: Number, required: true },
  sourceStart: Number,
  sourceEnd: Number,
  sourceId: String,
  volume: Number,
  muted: Boolean,
  position: { x: Number, y: Number },
  scale: Number,
  rotation: Number,
  opacity: Number,
  fadeIn: Number,
  fadeOut: Number,
  content: String,
  fontFamily: String,
  fontSize: Number,
  fontWeight: Number,
  color: String,
  backgroundColor: String,
  alignment: { type: String, enum: ['left', 'center', 'right'] },
  animation: {
    type: { type: String, enum: ['fade', 'slide', 'typewriter', 'none'] },
    duration: Number,
  },
}, { _id: false })

const TransitionSchema = new Schema({
  id: { type: String, required: true },
  clipId: { type: String, required: true },
  type: { type: String, required: true },
  duration: { type: Number, required: true },
}, { _id: false })

const EffectSchema = new Schema({
  id: { type: String, required: true },
  clipId: { type: String, required: true },
  type: { type: String, required: true },
  params: { type: Map, of: Schema.Types.Mixed },
}, { _id: false })

const ProjectSchema = new Schema<Project>({
  name: { type: String, required: true },
  description: String,
  resolution: {
    width: { type: Number, default: 1920 },
    height: { type: Number, default: 1080 },
  },
  frameRate: { type: Number, default: 30 },
  duration: { type: Number, default: 0 },
  tracks: { type: [TrackSchema], default: [] },
  clips: { type: [ClipSchema], default: [] },
  transitions: { type: [TransitionSchema], default: [] },
  effects: { type: [EffectSchema], default: [] },
}, {
  timestamps: true,
})

export const ProjectModel = mongoose.models.Project || mongoose.model<Project>('Project', ProjectSchema)
