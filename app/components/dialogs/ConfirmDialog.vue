<script setup lang="ts">
const { t } = useI18n()

withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'primary' | 'error' | 'warning'
}>(), {
  title: '',
  description: '',
  confirmLabel: '',
  cancelLabel: '',
  confirmColor: 'error',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
  'cancel': []
}>()

function handleConfirm() {
  emit('confirm')
  emit('update:open', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}

function handleOpenChange(value: boolean) {
  emit('update:open', value)
  if (!value) {
    emit('cancel')
  }
}
</script>

<template>
  <u-modal
    :open="open"
    @update:open="handleOpenChange"
  >
    <template #content>
      <u-card>
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ title || t('common.confirm') }}
          </h3>
        </template>

        <p class="text-gray-600 dark:text-gray-400">
          {{ description }}
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <u-button
              variant="ghost"
              color="neutral"
              @click="handleCancel"
            >
              {{ cancelLabel || t('common.cancel') }}
            </u-button>
            <u-button
              :color="confirmColor"
              @click="handleConfirm"
            >
              {{ confirmLabel || t('common.confirm') }}
            </u-button>
          </div>
        </template>
      </u-card>
    </template>
  </u-modal>
</template>
