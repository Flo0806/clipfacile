<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()
const { state, initializeProject } = useEditorState()
const { isPlaying, togglePlayback, seek } = usePreviewEngine()

const projectName = ref(t('common.untitled'))

// Initialize project on mount
onMounted(() => {
  initializeProject()
})

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

function saveProject() {
  // TODO: Implement save
  console.log('Saving project...')
}

// Format time as MM:SS
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// Skip backward/forward by 5 seconds
function skipBackward() {
  seek(Math.max(0, state.currentTime - 5000))
}

function skipForward() {
  seek(Math.min(state.duration, state.currentTime + 5000))
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  // Ignore if focused on input
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  switch (event.code) {
    case 'Space':
      event.preventDefault()
      togglePlayback()
      break
    case 'ArrowLeft':
      event.preventDefault()
      skipBackward()
      break
    case 'ArrowRight':
      event.preventDefault()
      skipForward()
      break
    case 'Home':
      event.preventDefault()
      seek(0)
      break
    case 'End':
      event.preventDefault()
      seek(state.duration)
      break
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center gap-4">
        <nuxt-link
          to="/"
          class="text-lg font-bold gradient-text"
        >
          {{ t('app.name') }}
        </nuxt-link>
        <u-input
          v-model="projectName"
          variant="ghost"
          class="font-medium"
        />
      </div>

      <div class="flex items-center gap-2">
        <u-button
          icon="i-heroicons-arrow-uturn-left"
          variant="ghost"
          color="neutral"
          :aria-label="t('editor.undo')"
        />
        <u-button
          icon="i-heroicons-arrow-uturn-right"
          variant="ghost"
          color="neutral"
          :aria-label="t('editor.redo')"
        />
        <u-separator
          orientation="vertical"
          class="h-6"
        />
        <client-only>
          <u-button
            :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
            variant="ghost"
            color="neutral"
            @click="toggleTheme"
          />
          <template #fallback>
            <u-button
              icon="i-heroicons-moon"
              variant="ghost"
              color="neutral"
              disabled
            />
          </template>
        </client-only>
        <u-button
          icon="i-heroicons-arrow-down-tray"
          variant="soft"
          color="primary"
        >
          {{ t('editor.export') }}
        </u-button>
        <u-button
          icon="i-heroicons-cloud-arrow-up"
          color="primary"
          @click="saveProject"
        >
          {{ t('common.save') }}
        </u-button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Media Library Sidebar -->
      <editor-media-library />

      <!-- Preview Area -->
      <main class="flex-1 flex flex-col">
        <div class="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
          <div class="aspect-video w-full max-w-4xl bg-black rounded-lg overflow-hidden shadow-xl">
            <editor-preview />
          </div>
        </div>

        <!-- Playback Controls -->
        <div class="flex items-center justify-center gap-4 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <u-button
            icon="i-heroicons-backward"
            variant="ghost"
            color="neutral"
            size="lg"
            :aria-label="t('editor.skipBackward')"
            @click="skipBackward"
          />
          <u-button
            :icon="isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
            color="primary"
            size="xl"
            class="rounded-full"
            :aria-label="isPlaying ? t('editor.pause') : t('editor.play')"
            @click="togglePlayback"
          />
          <u-button
            icon="i-heroicons-forward"
            variant="ghost"
            color="neutral"
            size="lg"
            :aria-label="t('editor.skipForward')"
            @click="skipForward"
          />
          <span class="text-sm text-gray-500 font-mono ml-4">
            {{ formatTime(state.currentTime) }} / {{ formatTime(state.duration) }}
          </span>
        </div>
      </main>
    </div>

    <!-- Timeline -->
    <div class="h-52 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <editor-timeline />
    </div>
  </div>
</template>
