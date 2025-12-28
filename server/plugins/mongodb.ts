import mongoose from 'mongoose'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()

  if (!config.mongodbUri) {
    console.warn('[MongoDB] MONGODB_URI not configured, skipping connection')
    return
  }

  try {
    await mongoose.connect(config.mongodbUri)
    console.log('[MongoDB] Connected successfully')
  }
  catch (error) {
    console.error('[MongoDB] Connection failed:', error)
  }
})
