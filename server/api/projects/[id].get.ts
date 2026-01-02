import { ProjectModel } from '../../models/project'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project ID required',
    })
  }

  const project = await ProjectModel.findById(id)

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found',
    })
  }

  return {
    id: project._id.toString(),
    name: project.name,
    description: project.description,
    resolution: project.resolution,
    frameRate: project.frameRate,
    duration: project.duration,
    tracks: project.tracks,
    clips: project.clips,
    transitions: project.transitions,
    effects: project.effects,
    mediaFiles: project.mediaFiles || [],
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
})
