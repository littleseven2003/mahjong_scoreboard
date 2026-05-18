<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type RoomState } from '../api/client'
import { useRoomStore } from '../stores/room'

const router = useRouter()
const roomStore = useRoomStore()

const createForm = reactive({
  playerCount: 4,
  name: '',
  initialScore: 1000,
  scoreRate: 1,
  allowNegative: true,
  ownerNickname: ''
})

const joinCode = ref('')
const joinNickname = ref('')
const CONTINUE_TIMEOUT_MS = 12 * 60 * 60 * 1000
type ContinueRoom = {
  state: RoomState
  isExpired: boolean
}

const continuableRooms = ref<ContinueRoom[]>([])
const continueLoading = ref(false)

const createErrors = reactive({
  ownerNickname: '',
  initialScore: '',
  scoreRate: ''
})

const joinErrors = reactive({
  code: '',
  nickname: ''
})

function clearCreateErrors() {
  createErrors.ownerNickname = ''
  createErrors.initialScore = ''
  createErrors.scoreRate = ''
}

function clearJoinErrors() {
  joinErrors.code = ''
  joinErrors.nickname = ''
}

function validateCreateForm() {
  clearCreateErrors()
  const initialScore = Number(createForm.initialScore)
  const scoreRate = Number(createForm.scoreRate)

  if (!createForm.ownerNickname.trim()) {
    createErrors.ownerNickname = '请填写房主昵称'
  }
  if (!Number.isInteger(initialScore) || initialScore < 0) {
    createErrors.initialScore = '起始分必须是 0 或正整数'
  }
  if (!Number.isFinite(scoreRate) || scoreRate <= 0) {
    createErrors.scoreRate = '计分单位必须大于 0'
  }

  return !createErrors.ownerNickname && !createErrors.initialScore && !createErrors.scoreRate
}

function validateJoinForm() {
  clearJoinErrors()
  if (!joinCode.value.trim()) {
    joinErrors.code = '请填写房间号'
  }
  if (!joinNickname.value.trim()) {
    joinErrors.nickname = '请填写玩家昵称'
  }
  return !joinErrors.code && !joinErrors.nickname
}

async function createRoom() {
  if (!validateCreateForm()) return
  try {
    const result = await roomStore.createRoom(createForm)
    router.push(`/room/${result.state.room.code}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('起始分')) createErrors.initialScore = message
    else if (message.includes('计分单位')) createErrors.scoreRate = message
    else if (message.includes('昵称')) createErrors.ownerNickname = message
  }
}

async function joinRoom() {
  if (!validateJoinForm()) return
  try {
    const result = await roomStore.joinRoom(joinCode.value, joinNickname.value)
    router.push(`/room/${result.state.room.code}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('房间')) joinErrors.code = message
    else if (message.includes('昵称')) joinErrors.nickname = message
  }
}

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
    <header class="topbar">
      <div>
        <p class="eyebrow">麻将桌计分器</p>
        <h1>开桌记分</h1>
      </div>
      <RouterLink class="ghost-button" to="/history">历史</RouterLink>
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

    <section class="panel">
      <h2>创建房间</h2>
      <label>
        房间名称
        <input v-model="createForm.name" placeholder="今晚这桌" />
      </label>
      <label>
        房主昵称
        <input v-model="createForm.ownerNickname" placeholder="你的昵称" @input="createErrors.ownerNickname = ''" />
        <small v-if="createErrors.ownerNickname" class="field-error">{{ createErrors.ownerNickname }}</small>
      </label>
      <div class="grid two">
        <label>
          起始分
          <input v-model.number="createForm.initialScore" type="number" min="0" @input="createErrors.initialScore = ''" />
          <small v-if="createErrors.initialScore" class="field-error">{{ createErrors.initialScore }}</small>
        </label>
        <label>
          计分单位
          <input v-model.number="createForm.scoreRate" type="number" min="0.1" step="0.1" @input="createErrors.scoreRate = ''" />
          <small v-if="createErrors.scoreRate" class="field-error">{{ createErrors.scoreRate }}</small>
        </label>
      </div>
      <label class="check-row">
        <input v-model="createForm.allowNegative" type="checkbox" />
        允许负分
      </label>
      <button class="primary-button" :disabled="roomStore.loading" @click="createRoom">创建房间</button>
    </section>

    <section class="panel">
      <h2>加入房间</h2>
      <label>
        房间号
        <input v-model.trim="joinCode" maxlength="6" placeholder="例如 A2B3C4" class="code-input" @input="joinErrors.code = ''" />
        <small v-if="joinErrors.code" class="field-error">{{ joinErrors.code }}</small>
      </label>
      <label>
        玩家昵称
        <input v-model="joinNickname" placeholder="你的昵称" @input="joinErrors.nickname = ''" />
        <small v-if="joinErrors.nickname" class="field-error">{{ joinErrors.nickname }}</small>
      </label>
      <button class="secondary-button" :disabled="roomStore.loading" @click="joinRoom">加入房间</button>
    </section>

    <p v-if="roomStore.error" class="error-text">{{ roomStore.error }}</p>
  </main>
</template>
