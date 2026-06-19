<template>
  <div
    v-if="error"
    class="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-sm"
  >
    <div class="flex items-start gap-2">
      <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-red-300">{{ error.message }}</p>
        <div v-if="error.retry || dismissible" class="flex gap-2 mt-2">
          <button
            v-if="error.retry"
            @click="handleRetry"
            class="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
          >
            重试
          </button>
          <button
            v-if="dismissible"
            @click="handleDismiss"
            class="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OperationError } from '../store/game';

interface Props {
  error: OperationError | null;
  dismissible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  dismissible: false,
});

const emit = defineEmits<{
  retry: [];
  dismiss: [];
}>();

function handleRetry() {
  if (props.error?.retry) {
    props.error.retry();
  }
  emit('retry');
}

function handleDismiss() {
  emit('dismiss');
}
</script>
