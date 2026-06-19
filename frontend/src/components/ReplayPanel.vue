<template>
  <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-bold text-green-400">棋谱回放</h3>
      <button
        v-if="store.status !== 'replaying'"
        @click="store.loadRecords()"
        :disabled="store.isLoadingRecords"
        class="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        title="刷新列表"
      >
        <svg class="w-4 h-4" :class="{ 'animate-spin': store.isLoadingRecords }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>

    <ErrorAlert
      v-if="store.loadRecordsError && store.status !== 'replaying'"
      :error="store.loadRecordsError"
      :dismissible="false"
    />

    <div v-if="store.status !== 'replaying'">
      <div v-if="store.isLoadingRecords" class="flex items-center justify-center py-8">
        <svg class="animate-spin h-6 w-6 text-green-400" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      </div>
      <template v-else>
        <p v-if="store.gameRecords.length === 0" class="text-gray-500 text-sm">暂无棋谱记录</p>
        <div v-else class="space-y-2 max-h-64 overflow-y-auto">
          <div
            v-for="record in store.gameRecords"
            :key="record.id"
            class="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700"
            @click="store.startReplay(record)"
          >
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-300">{{ record.createdAt }}</span>
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="record.winner === 1 ? 'bg-gray-700 text-gray-200' : record.winner === 2 ? 'bg-white text-black' : 'bg-yellow-600 text-white'"
              >
                {{ record.winner === 1 ? '黑棋胜' : record.winner === 2 ? '白棋胜' : '平局' }}
              </span>
            </div>
            <div class="text-xs text-gray-500 mt-1">共 {{ record.moves.length }} 手</div>
          </div>
        </div>
      </template>
    </div>

    <div v-else>
      <div class="text-center mb-3">
        <span class="text-gray-400 text-sm">第 {{ store.replayIndex }} / {{ store.replayMoves.length }} 手</span>
      </div>

      <div class="w-full bg-gray-800 rounded-full h-2 mb-4">
        <div
          class="bg-green-500 h-2 rounded-full transition-all"
          :style="{ width: `${(store.replayIndex / store.replayMoves.length) * 100}%` }"
        />
      </div>

      <div class="flex items-center justify-center gap-2 mb-4">
        <button @click="store.replayGoToStart()" class="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-300 transition-colors" title="回到开始">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
        </button>
        <button @click="store.replayStepBack()" class="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-300 transition-colors" title="上一步">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <button @click="store.toggleReplayPlay()" class="p-3 bg-green-600 rounded-lg hover:bg-green-500 text-white transition-colors" :title="store.isReplayPlaying ? '暂停' : '播放'">
          <svg v-if="!store.isReplayPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        </button>
        <button @click="store.replayStepForward()" class="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-300 transition-colors" title="下一步">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
        <button @click="store.replayGoToEnd()" class="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-300 transition-colors" title="跳到结尾">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div class="flex items-center justify-center gap-2 mb-4">
        <span class="text-xs text-gray-500">速度:</span>
        <button
          v-for="speed in speeds"
          :key="speed.value"
          @click="store.setReplaySpeed(speed.value)"
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="store.replaySpeed === speed.value ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
        >
          {{ speed.label }}
        </button>
      </div>

      <button
        @click="store.stopReplay()"
        class="w-full py-2 bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
      >
        退出回放
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useGameStore } from '../store/game';
import ErrorAlert from './ErrorAlert.vue';

const store = useGameStore();

onMounted(() => {
  store.loadRecords();
});

const speeds = [
  { label: '慢', value: 2000 },
  { label: '中', value: 1000 },
  { label: '快', value: 500 },
  { label: '极快', value: 200 },
];
</script>
