import { ProjectModel } from '../../models/project'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project ID required',
    })
  }

  // Delete project
  const project = await ProjectModel.findByIdAndDelete(id)

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found',
    })
  }

  // Delete associated media files
  const storage = useStorage('uploads')
  const prefix = `${id}/`

  try {
    const keys = await storage.getKeys(prefix)
    for (const key of keys) {
      await storage.removeItem(key)
    }
  } catch (e) {
    console.error('Error deleting project files:', e)
  }

  return { success: true }
})
