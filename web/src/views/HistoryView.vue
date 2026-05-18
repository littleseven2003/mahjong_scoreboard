<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Room } from '../api/client'

const rooms = ref<Room[]>([])
const error = ref('')

onMounted(async () => {
  try {
    rooms.value = await api.history()
  } catch (message) {
    error.value = message instanceof Error ? message.message : '历史记录加载失败'
  }
})
</script>

<template>
  <main class="app-shell">
    <header class="topbar compact">
      <RouterLink class="icon-button" to="/">←</RouterLink>
      <div>
        <p class="eyebrow">已结束对局</p>
        <h1>历史记录</h1>
      </div>
    </header>

    <p v-if="error" class="error-text">{{ error }}</p>
    <div v-if="!rooms.length" class="empty">暂无历史对局</div>
    <section v-else class="history-list">
      <RouterLink v-for="room in rooms" :key="room.id" class="history-item" :to="`/history/${room.id}`">
        <strong>{{ room.name || room.code }}</strong>
        <span>{{ room.playerNames || '暂无玩家' }}</span>
        <small>{{ room.finishedAt ? new Date(room.finishedAt).toLocaleString() : '' }}</small>
      </RouterLink>
    </section>
  </main>
</template>
