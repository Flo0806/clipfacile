<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-8">
    <div class="text-center max-w-2xl">
      <h1 class="text-5xl font-bold gradient-text mb-4">
        {{ t('app.name') }}
      </h1>
      <p class="text-xl text-gray-600 dark:text-gray-400 mb-8">
        {{ t('app.tagline') }}
      </p>
      <nuxt-link to="/editor">
        <u-button
          size="xl"
          icon="i-heroicons-play-circle"
          class="gradient-primary"
        >
          {{ t('editor.newProject') }}
        </u-button>
      </nuxt-link>
    </div>
  </div>
</template>
