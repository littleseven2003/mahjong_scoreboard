<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type RoomState } from '../api/client'
import AppLogo from '../components/AppLogo.vue'

const CONTINUE_TIMEOUT_MS = 12 * 60 * 60 * 1000
const githubUrl = 'https://github.com/littleseven2003/mahjong_scoreboard'
const author = 'littleseven2003'
const version = 'v1.2.1'
const homeHighlights = ['实时同步', '双方确认撤销', 'Docker 部署']

type ContinueRoom = {
  state: RoomState
  isExpired: boolean
}

const continuableRooms = ref<ContinueRoom[]>([])
const continueLoading = ref(false)

async function loadContinuableRooms() {
  continueLoading.value = true
  try {
    const pairs = Object.keys(localStorage)
      .filter((key) => key.startsWith('mahjong_scoreboard_player_'))
      .map((key) => ({
        code: key.replace('mahjong_scoreboard_player_', ''),
        playerId: Number(localStorage.getItem(key))
      }))
      .filter((pair) => pair.code && Number.isInteger(pair.playerId))

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
  } finally {
    continueLoading.value = false
  }
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
      <p class="home-subtitle">为线下麻将桌准备的轻量记分工具，支持创建房间、加入对局、准备开局、流水撤销和历史结算。</p>
      <div class="home-highlight-row">
        <span v-for="item in homeHighlights" :key="item">{{ item }}</span>
      </div>
      <div class="home-actions">
        <RouterLink class="primary-button" to="/room/create">创建房间</RouterLink>
        <RouterLink class="secondary-button" to="/room/join">加入房间</RouterLink>
        <RouterLink class="ghost-button" to="/history">历史记录</RouterLink>
      </div>
    </header>

    <section class="home-info-grid">
      <article>
        <strong>轻量开桌</strong>
        <span>三人或四人房间，房主设置起始分和计分单位。</span>
      </article>
      <article>
        <strong>多人同步</strong>
        <span>积分、撤销和结算都会同步到同房间玩家页面。</span>
      </article>
      <article>
        <strong>清晰流水</strong>
        <span>每笔变动保留记录，撤销需要相关双方确认。</span>
      </article>
    </section>

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
            移除
          </button>
        </div>
      </div>
    </section>

    <footer class="project-footer">
      <a :href="githubUrl" target="_blank" rel="noreferrer">GitHub：{{ githubUrl }}</a>
      <span>作者：{{ author }}</span>
      <span>版本：{{ version }}</span>
      <span>协议：GPL-3.0</span>
    </footer>
  </main>
</template>
