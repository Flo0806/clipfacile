<script setup lang="ts">
const props = defineProps<{
  pixelsPerMs: number
  duration: number
  containerWidth: number // visible container width
}>()

const emit = defineEmits<{
  seek: [timeMs: number]
}>()

const rulerContentRef = ref<HTMLElement>()

// Track label (w-32=128px) + gap-2 (8px) + container px-2 (8px) = 144px
const LABEL_WIDTH = 144

// Calculate appropriate interval based on zoom level
const markerInterval = computed(() => {
  const targetPixels = 80

  const intervals = [
    100, 250, 500, 1000, 2000, 5000,
    10000, 30000, 60000, 300000, 600000,
  ]

  for (const interval of intervals) {
    if (interval * props.pixelsPerMs >= targetPixels) {
      return interval
    }
  }
  return intervals[intervals.length - 1]!
})

// Content area width (excluding label)
const contentWidth = computed(() => {
  const visibleContentWidth = Math.max(0, props.containerWidth - LABEL_WIDTH)

  // Round up duration to next nice interval for display
  const interval = markerInterval.value
  const roundedDuration = Math.ceil(props.duration / interval) * interval
  const roundedWidth = roundedDuration * props.pixelsPerMs

  // Use the larger of: visible width, or rounded content width + buffer
  return Math.max(visibleContentWidth, roundedWidth + 100)
})

// Total ruler width
const rulerWidth = computed(() => LABEL_WIDTH + contentWidth.value)

// Generate markers
const markers = computed(() => {
  const result: { time: number, position: number, label: string, isMain: boolean }[] = []
  const interval = markerInterval.value
  const maxTime = contentWidth.value / props.pixelsPerMs

  for (let time = 0; time <= maxTime; time += interval) {
    result.push({
      time,
      position: time * props.pixelsPerMs,
      label: formatTime(time),
      isMain: time % (interval * 5) === 0 || interval >= 10000,
    })
  }
  return result
})

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (markerInterval.value < 1000) {
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function handleClick(event: MouseEvent) {
  if (!rulerContentRef.value) return

  const rect = rulerContentRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const timeMs = Math.max(0, x / props.pixelsPerMs)
  emit('seek', timeMs)
}
</script>

<template>
  <div
    class="h-6 relative bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 select-none flex"
    :style="{ width: `${rulerWidth}px` }"
  >
    <!-- Track label spacer (matches track label + gap + container padding) -->
    <div
      class="shrink-0 h-full bg-gray-50 dark:bg-gray-900"
      :style="{ width: `${LABEL_WIDTH}px` }"
    />

    <!-- Markers area (clickable) -->
    <div
      ref="rulerContentRef"
      class="relative flex-1 h-full cursor-pointer"
      @click="handleClick"
    >
      <div
        v-for="marker in markers"
        :key="marker.time"
        class="absolute top-0 h-full"
        :style="{ left: `${marker.position}px` }"
      >
        <!-- Tick line -->
        <div
          class="w-px"
          :class="[
            marker.isMain
              ? 'h-full bg-gray-400 dark:bg-gray-500'
              : 'h-2 bg-gray-300 dark:bg-gray-600',
          ]"
        />
        <!-- Label -->
        <span
          v-if="marker.isMain"
          class="absolute bottom-0.5 left-1 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap"
        >
          {{ marker.label }}
        </span>
      </div>
    </div>
  </div>
</template>
