import { ProjectModel } from '../../models/project'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string }>(event)

  const project = await ProjectModel.create({
    name: body.name || 'Unbenannt',
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    duration: 0,
    tracks: [],
    clips: [],
    transitions: [],
    effects: [],
  })

  return {
    id: project._id.toString(),
    name: project.name,
  }
})
