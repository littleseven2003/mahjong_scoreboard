<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type RoomState } from '../api/client'
import AppLogo from '../components/AppLogo.vue'

const CONTINUE_TIMEOUT_MS = 12 * 60 * 60 * 1000

type ContinueRoom = {
  state: RoomState
  isExpired: boolean
}

const continuableRooms = ref<ContinueRoom[]>([])
const continueLoading = ref(false)

async function loadContinuableRooms() {
  continueLoading.value = true
  const pairs = Object.keys(localStorage)
    .filter((key) => key.startsWith('mahjong_scoreboard_player_'))
    .map((key) => ({
      code: key.replace('mahjong_scoreboard_player_', ''),
      playerId: Number(localStorage.getItem(key))
    }))

  const results = await Promise.allSettled(pairs.map(async ({ code, playerId }) => {
    const roomState = await api.getRoom(code)
    const isCurrentPlayer = roomState.players.some((player) => player.id === playerId)
    if (!isCurrentPlayer || roomState.room.status === 'finished') return null

    const lastActiveAt = roomState.room.startedAt || roomState.room.createdAt
    const isExpired = Date.now() - new Date(lastActiveAt).getTime() > CONTINUE_TIMEOUT_MS
    return {
      state: roomState,
      isExpired
    }
  }))

  continuableRooms.value = results
    .map((result) => result.status === 'fulfilled' ? result.value : null)
    .filter((roomState): roomState is ContinueRoom => Boolean(roomState))
  continueLoading.value = false
}

function removeContinueRoom(code: string) {
  localStorage.removeItem(`mahjong_scoreboard_player_${code.toUpperCase()}`)
  continuableRooms.value = continuableRooms.value.filter((item) => item.state.room.code !== code)
}

onMounted(() => {
  loadContinuableRooms()
})
</script>

<template>
  <main class="app-shell">
    <header class="home-hero">
      <AppLogo />
      <div class="home-actions">
        <RouterLink class="primary-button" to="/room/create">创建房间</RouterLink>
        <RouterLink class="secondary-button" to="/room/join">加入房间</RouterLink>
        <RouterLink class="ghost-button" to="/history">历史记录</RouterLink>
      </div>
    </header>

    <section v-if="continuableRooms.length || continueLoading" class="panel">
      <div class="section-title">
        <h2>继续对局</h2>
        <span v-if="continueLoading">检查中</span>
      </div>
      <div v-if="continuableRooms.length" class="history-list">
        <div v-for="item in continuableRooms" :key="item.state.room.code" class="history-item continue-item" :class="{ expired: item.isExpired }">
          <RouterLink v-if="!item.isExpired" class="continue-link" :to="`/room/${item.state.room.code}`">
            <strong>{{ item.state.room.name || item.state.room.code }}</strong>
            <span>{{ item.state.players.map((player) => player.nickname).join('、') }}</span>
            <small>{{ item.state.room.status === 'waiting' ? '等待开局' : '进行中' }}</small>
          </RouterLink>
          <div v-else class="continue-link">
            <strong>{{ item.state.room.name || item.state.room.code }}</strong>
            <span>{{ item.state.players.map((player) => player.nickname).join('、') }}</span>
            <small>已超时</small>
          </div>
          <button
            v-if="item.isExpired"
            class="ghost-button danger compact-button"
            type="button"
            @click="removeContinueRoom(item.state.room.code)"
          >
            删除
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
