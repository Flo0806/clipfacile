import { extname } from 'node:path'
import { ProjectModel } from '../../../models/project'

const ALLOWED_VIDEO = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
const ALLOWED_AUDIO = ['.mp3', '.wav', '.ogg', '.aac', '.m4a']
const ALLOWED_IMAGE = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const MAX_SIZE = 500 * 1024 * 1024 // 500 MB

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project ID required',
    })
  }

  // Verify project exists
  const project = await ProjectModel.findById(projectId)
  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found',
    })
  }

  const files = await readMultipartFormData(event)
  if (!files?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    })
  }

  const file = files[0]
  if (!file.filename || !file.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file',
    })
  }

  const ext = extname(file.filename).toLowerCase()
  const allAllowed = [...ALLOWED_VIDEO, ...ALLOWED_AUDIO, ...ALLOWED_IMAGE]

  if (!allAllowed.includes(ext)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid file type. Allowed: ${allAllowed.join(', ')}`,
    })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({
      statusCode: 413,
      statusMessage: 'File too large. Max 500 MB.',
    })
  }

  // Determine media type
  let type: 'video' | 'audio' | 'image'
  if (ALLOWED_VIDEO.includes(ext)) type = 'video'
  else if (ALLOWED_AUDIO.includes(ext)) type = 'audio'
  else type = 'image'

  // Generate unique filename
  const mediaId = crypto.randomUUID()
  const filename = `${mediaId}${ext}`
  const storagePath = `${projectId}/${filename}`

  // Save to storage
  const storage = useStorage('uploads')
  await storage.setItemRaw(storagePath, file.data)

  const mimeType = file.type || 'application/octet-stream'

  // Save media file metadata to project
  await ProjectModel.findByIdAndUpdate(projectId, {
    $push: {
      mediaFiles: {
        id: mediaId,
        name: file.filename,
        type,
        mimeType,
        size: file.data.length,
        duration: -1, // Will be updated client-side
        filename,
      },
    },
  })

  return {
    id: mediaId,
    filename,
    originalName: file.filename,
    type,
    mimeType,
    size: file.data.length,
    url: `/api/media/${projectId}/${filename}`,
  }
})
