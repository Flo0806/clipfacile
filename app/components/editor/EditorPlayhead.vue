<script setup lang="ts">
const props = defineProps<{
  currentTime: number
  pixelsPerMs: number
}>()

// Track label (w-24=96px) + gap-2 (8px) + container px-2 (8px) = 112px
const LABEL_WIDTH = 112

const playheadStyle = computed(() => ({
  left: `${LABEL_WIDTH + props.currentTime * props.pixelsPerMs}px`,
}))
</script>

<template>
  <div
    class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 pointer-events-none"
    :style="playheadStyle"
  >
    <!-- Playhead handle (top triangle) -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-8 border-l-transparent border-r-transparent border-t-red-500"
    />
  </div>
</template>
