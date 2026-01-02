import { ProjectModel } from '../../models/project'

export default defineEventHandler(async () => {
  const projects = await ProjectModel.find()
    .select('name duration clips createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .lean()

  return projects.map((project) => ({
    id: project._id.toString(),
    name: project.name,
    duration: project.duration || 0,
    clipCount: project.clips?.length || 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }))
})
