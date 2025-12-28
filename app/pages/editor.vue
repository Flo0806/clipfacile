<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()
const { state, initializeProject } = useEditorState()

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
        <u-button
          :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          variant="ghost"
          color="neutral"
          @click="toggleTheme"
        />
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
          <div class="aspect-video w-full max-w-4xl bg-black rounded-lg flex items-center justify-center shadow-xl">
            <span class="text-gray-500">{{ t('editor.preview') }}</span>
          </div>
        </div>

        <!-- Playback Controls -->
        <div class="flex items-center justify-center gap-4 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <u-button
            icon="i-heroicons-backward"
            variant="ghost"
            color="neutral"
            size="lg"
          />
          <u-button
            :icon="state.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
            color="primary"
            size="xl"
            class="rounded-full"
          />
          <u-button
            icon="i-heroicons-forward"
            variant="ghost"
            color="neutral"
            size="lg"
          />
          <span class="text-sm text-gray-500 font-mono ml-4">
            00:00:00 / {{ Math.floor(state.duration / 1000) }}s
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
