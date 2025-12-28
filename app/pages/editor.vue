<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()

const projectName = ref(t('common.untitled'))
const isPlaying = ref(false)

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

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
        <nuxt-link to="/" class="text-lg font-bold gradient-text">
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
        <u-divider orientation="vertical" class="h-6" />
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
      <!-- Sidebar -->
      <aside class="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
          {{ t('editor.import') }}
        </h3>
        <u-button
          icon="i-heroicons-plus"
          variant="dashed"
          color="neutral"
          block
        >
          {{ t('editor.video') }}
        </u-button>
        <u-button
          icon="i-heroicons-plus"
          variant="dashed"
          color="neutral"
          block
          class="mt-2"
        >
          {{ t('editor.audio') }}
        </u-button>
      </aside>

      <!-- Preview Area -->
      <main class="flex-1 flex flex-col">
        <div class="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div class="aspect-video w-full max-w-4xl bg-black rounded-lg flex items-center justify-center">
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
            :icon="isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
            color="primary"
            size="xl"
            class="rounded-full"
            @click="togglePlay"
          />
          <u-button
            icon="i-heroicons-forward"
            variant="ghost"
            color="neutral"
            size="lg"
          />
          <span class="text-sm text-gray-500 font-mono ml-4">00:00:00 / 00:00:00</span>
        </div>
      </main>
    </div>

    <!-- Timeline -->
    <div class="h-48 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <h3 class="text-sm font-semibold">{{ t('editor.timeline') }}</h3>
        <div class="flex items-center gap-2">
          <u-button
            icon="i-heroicons-minus"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('editor.zoomOut')"
          />
          <u-button
            icon="i-heroicons-plus"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('editor.zoomIn')"
          />
          <u-button
            icon="i-heroicons-plus"
            variant="soft"
            color="primary"
            size="xs"
          >
            {{ t('editor.addTrack') }}
          </u-button>
        </div>
      </div>

      <!-- Track Area -->
      <div class="p-2 space-y-1">
        <!-- Example Tracks -->
        <div class="flex items-center gap-2 h-10 bg-gray-100 dark:bg-gray-800 rounded px-2">
          <span class="text-xs font-medium w-20 text-cyan-600 dark:text-cyan-400">Video 1</span>
          <div class="flex-1 h-6 bg-cyan-500/20 rounded border border-cyan-500/30" />
        </div>
        <div class="flex items-center gap-2 h-10 bg-gray-100 dark:bg-gray-800 rounded px-2">
          <span class="text-xs font-medium w-20 text-purple-600 dark:text-purple-400">Audio 1</span>
          <div class="flex-1 h-6 bg-purple-500/20 rounded border border-purple-500/30" />
        </div>
        <div class="flex items-center gap-2 h-10 bg-gray-100 dark:bg-gray-800 rounded px-2">
          <span class="text-xs font-medium w-20 text-gray-600 dark:text-gray-400">Text 1</span>
          <div class="flex-1 h-6 bg-gray-500/20 rounded border border-gray-500/30" />
        </div>
      </div>
    </div>
  </div>
</template>
