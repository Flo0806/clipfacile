import { ProjectModel } from '../../models/project'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project ID required',
    })
  }

  const body = await readBody<{
    name?: string
    tracks?: unknown[]
    clips?: unknown[]
    duration?: number
    transitions?: unknown[]
    effects?: unknown[]
  }>(event)

  // Only update provided fields
  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.tracks !== undefined) updateData.tracks = body.tracks
  if (body.clips !== undefined) updateData.clips = body.clips
  if (body.duration !== undefined) updateData.duration = body.duration
  if (body.transitions !== undefined) updateData.transitions = body.transitions
  if (body.effects !== undefined) updateData.effects = body.effects

  const project = await ProjectModel.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true },
  )

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found',
    })
  }

  return {
    id: project._id.toString(),
    updatedAt: project.updatedAt,
  }
})
