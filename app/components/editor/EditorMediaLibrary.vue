<script setup lang="ts">
const { t } = useI18n()
const { state, addMediaFile } = useEditorState()

const fileInput = ref<HTMLInputElement>()
const isLoading = ref(false)

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  isLoading.value = true
  try {
    for (const file of input.files) {
      await addMediaFile(file)
    }
  } catch (error) {
    console.error('Failed to import file:', error)
  } finally {
    isLoading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function handleDragStart(event: DragEvent, mediaFile: MediaFile) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copyMove'
    // Clip type: video/image → video track, audio → audio track
    const clipType = mediaFile.type === 'audio' ? 'audio' : 'video'
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: 'media',
      id: mediaFile.id,
    }))
    // Set custom type so dragover can check compatibility
    event.dataTransfer.setData(`application/clipfacile-${clipType}`, '')
  }
}

function formatDuration(ms: number): string {
  if (ms === -1) return t('editor.image')
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <aside class="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
    <div class="p-4 border-b border-gray-200 dark:border-gray-800">
      <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
        {{ t('editor.import') }}
      </h3>

      <input
        ref="fileInput"
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        class="hidden"
        @change="handleFileSelect"
      >

      <u-button
        icon="i-heroicons-folder-plus"
        variant="soft"
        color="primary"
        block
        :loading="isLoading"
        @click="openFilePicker"
      >
        {{ t('editor.import') }}
      </u-button>
    </div>

    <!-- Media List -->
    <div class="flex-1 overflow-auto p-2">
      <div
        v-if="state.mediaFiles.length === 0"
        class="flex flex-col items-center justify-center h-32 text-gray-400 text-sm text-center px-4"
      >
        <u-icon
          name="i-heroicons-film"
          class="w-8 h-8 mb-2"
        />
        <p>{{ t('editor.dragHint') }}</p>
      </div>

      <div
        v-else
        class="space-y-2"
      >
        <div
          v-for="media in state.mediaFiles"
          :key="media.id"
          class="group relative p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 cursor-grab transition-colors"
          draggable="true"
          @dragstart="(e) => handleDragStart(e, media)"
        >
          <!-- Thumbnail -->
          <div class="aspect-video bg-gray-100 dark:bg-gray-800 rounded mb-2 flex items-center justify-center overflow-hidden">
            <video
              v-if="media.type === 'video'"
              :src="media.url"
              class="w-full h-full object-cover"
              muted
              preload="metadata"
              disablepictureinpicture
            />
            <img
              v-else-if="media.type === 'image'"
              :src="media.url"
              class="w-full h-full object-cover"
            >
            <u-icon
              v-else
              name="i-heroicons-musical-note"
              class="w-8 h-8 text-purple-500"
            />
          </div>

          <!-- Info -->
          <p class="text-xs font-medium truncate">
            {{ media.name }}
          </p>
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>{{ formatDuration(media.duration) }}</span>
            <span>{{ formatSize(media.size) }}</span>
          </div>

          <!-- Drag Hint -->
          <div class="absolute inset-0 bg-primary-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span class="text-xs font-medium text-primary-600 dark:text-primary-400">
              {{ t('editor.dragToTimeline') }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
