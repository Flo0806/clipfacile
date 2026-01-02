<script setup lang="ts">
const { t } = useI18n()
const { loadProject, initializeProject } = useEditorState()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const projects = ref<ProjectListItem[]>([])
const isLoading = ref(false)
const isLoadingProject = ref<string | null>(null)
const deleteConfirmOpen = ref(false)
const projectToDelete = ref<ProjectListItem | null>(null)

async function fetchProjects() {
  isLoading.value = true
  try {
    projects.value = await $fetch<ProjectListItem[]>('/api/projects')
  } catch (error) {
    console.error('Failed to fetch projects:', error)
  } finally {
    isLoading.value = false
  }
}

async function handleSelectProject(projectId: string) {
  if (isLoadingProject.value) return

  isLoadingProject.value = projectId
  await nextTick()

  try {
    await loadProject(projectId)
    emit('update:open', false)
  } catch (error) {
    console.error('Failed to load project:', error)
  } finally {
    isLoadingProject.value = null
  }
}

function handleNewProject() {
  initializeProject()
  emit('update:open', false)
}

function confirmDelete(project: ProjectListItem) {
  projectToDelete.value = project
  deleteConfirmOpen.value = true
}

async function handleDeleteProject() {
  if (!projectToDelete.value) return

  try {
    await $fetch(`/api/projects/${projectToDelete.value.id}`, { method: 'DELETE' })
    projects.value = projects.value.filter((p) => p.id !== projectToDelete.value?.id)
  } catch (error) {
    console.error('Failed to delete project:', error)
  } finally {
    projectToDelete.value = null
  }
}

function formatDuration(ms: number): string {
  if (!ms) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Fetch projects when dialog opens
watch(() => props.open, (open) => {
  if (open) {
    fetchProjects()
  }
})
</script>

<template>
  <u-modal
    :open="open"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #content>
      <u-card class="sm:min-w-125 sm:max-w-150">
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <h3 class="text-lg font-semibold">
              {{ t('projects.title') }}
            </h3>
            <u-button
              icon="i-heroicons-plus"
              size="sm"
              @click="handleNewProject"
            >
              {{ t('projects.new') }}
            </u-button>
          </div>
        </template>

        <!-- Loading State -->
        <div
          v-if="isLoading"
          class="flex items-center justify-center py-12"
        >
          <u-icon
            name="i-heroicons-arrow-path"
            class="w-6 h-6 animate-spin text-gray-400"
          />
        </div>

        <!-- Empty State -->
        <div
          v-else-if="projects.length === 0"
          class="flex flex-col items-center justify-center py-12 text-gray-400"
        >
          <u-icon
            name="i-heroicons-film"
            class="w-12 h-12 mb-3"
          />
          <p class="text-sm">
            {{ t('projects.empty') }}
          </p>
        </div>

        <!-- Projects List -->
        <div
          v-else
          class="space-y-2 max-h-96 overflow-y-auto -mx-4 px-4"
        >
          <div
            v-for="project in projects"
            :key="project.id"
            :class="[
              'group flex items-center gap-3 p-3 rounded-lg border transition-colors',
              isLoadingProject === project.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 cursor-pointer',
            ]"
            @click="handleSelectProject(project.id)"
          >
            <!-- Thumbnail Placeholder / Loading -->
            <div class="w-20 h-12 rounded bg-linear-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
              <u-icon
                v-if="isLoadingProject === project.id"
                name="i-heroicons-arrow-path"
                class="w-5 h-5 text-primary-500 animate-spin"
              />
              <u-icon
                v-else
                name="i-heroicons-film"
                class="w-5 h-5 text-gray-400"
              />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate text-sm">
                {{ project.name }}
              </p>
              <div
                v-if="isLoadingProject === project.id"
                class="text-xs text-primary-500 mt-0.5"
              >
                {{ t('projects.loadingMedia') }}
              </div>
              <template v-else>
                <div class="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span class="flex items-center gap-1">
                    <u-icon
                      name="i-heroicons-clock"
                      class="w-3 h-3"
                    />
                    {{ formatDuration(project.duration) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <u-icon
                      name="i-heroicons-squares-2x2"
                      class="w-3 h-3"
                    />
                    {{ project.clipCount }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5 truncate">
                  {{ formatDate(project.updatedAt) }}
                </p>
              </template>
            </div>

            <!-- Delete Button -->
            <u-button
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              size="xs"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              @click.stop="confirmDelete(project)"
            />
          </div>
        </div>
      </u-card>
    </template>
  </u-modal>

  <!-- Delete Confirmation Dialog -->
  <dialogs-confirm-dialog
    v-model:open="deleteConfirmOpen"
    :title="t('projects.deleteTitle')"
    :description="t('projects.deleteConfirm', { name: projectToDelete?.name })"
    :confirm-label="t('common.delete')"
    confirm-color="error"
    @confirm="handleDeleteProject"
  />
</template>
