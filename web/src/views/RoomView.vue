<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import { useRoomStore } from '../stores/room'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()

const code = computed(() => String(route.params.code || '').toUpperCase())
const state = computed(() => roomStore.state)
const room = computed(() => state.value?.room)
const players = computed(() => state.value?.players || [])
const activeTransactions = computed(() => state.value?.transactions || [])
const latestTransactions = computed(() => activeTransactions.value.slice(0, 8))

const transferForm = reactive({
  fromPlayerId: 0,
  toPlayerId: 0,
  amount: 10,
  remark: ''
})

const quickAmounts = [1, 2, 5, 10, 20, 50, 100]

onMounted(() => {
  roomStore.loadRoom(code.value)
})

watch(players, (nextPlayers) => {
  if (!transferForm.fromPlayerId && nextPlayers[0]) transferForm.fromPlayerId = nextPlayers[0].id
  if (!transferForm.toPlayerId && nextPlayers[1]) transferForm.toPlayerId = nextPlayers[1].id
}, { immediate: true })

function playerDiff(score: number) {
  return score - (room.value?.initialScore || 0)
}

function diffClass(score: number) {
  const diff = playerDiff(score)
  return {
    win: diff > 0,
    lose: diff < 0
  }
}

function formatDiff(score: number) {
  const diff = playerDiff(score)
  return diff > 0 ? `+${diff}` : String(diff)
}

function ensurePlayer() {
  if (!roomStore.playerId) {
    roomStore.error = '当前浏览器不是该房间玩家，请从首页重新加入'
    return false
  }
  return true
}

async function startGame() {
  if (!ensurePlayer()) return
  await roomStore.applyAction(() => api.startGame(code.value, roomStore.playerId!))
}

async function submitTransfer() {
  if (!ensurePlayer()) return
  await roomStore.applyAction(() => api.transferScore(code.value, {
    ...transferForm,
    createdBy: roomStore.playerId
  }))
  transferForm.remark = ''
}

async function undo() {
  if (!ensurePlayer()) return
  if (!window.confirm('撤销上一笔有效流水？')) return
  await roomStore.applyAction(() => api.undo(code.value, roomStore.playerId!))
}

async function finish() {
  if (!ensurePlayer()) return
  if (!window.confirm('结束对局并生成结算？')) return
  await roomStore.applyAction(() => api.finish(code.value, roomStore.playerId!))
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar compact">
      <button class="icon-button" aria-label="返回首页" @click="router.push('/')">←</button>
      <div>
        <p class="eyebrow">房间 {{ code }}</p>
        <h1>{{ room?.name || '麻将桌' }}</h1>
      </div>
      <RouterLink class="ghost-button" to="/history">历史</RouterLink>
    </header>

    <p v-if="roomStore.error" class="error-text">{{ roomStore.error }}</p>
    <p v-if="roomStore.loading && !state" class="muted">正在载入房间...</p>

    <template v-if="state && room">
      <section class="score-board">
        <article v-for="player in players" :key="player.id" class="score-tile">
          <div class="player-name">
            {{ player.nickname }}
            <span v-if="player.isOwner">房主</span>
          </div>
          <strong>{{ player.currentScore }}</strong>
          <small :class="diffClass(player.currentScore)">{{ formatDiff(player.currentScore) }}</small>
        </article>
      </section>

      <section v-if="room.status === 'waiting'" class="panel">
        <div class="section-title">
          <h2>等待开局</h2>
          <span>{{ players.length }} / {{ room.playerCount }}</span>
        </div>
        <div class="list">
          <div v-for="player in players" :key="player.id" class="list-row">
            <span>{{ player.seatNo }} 位</span>
            <strong>{{ player.nickname }}</strong>
          </div>
        </div>
        <button class="primary-button" :disabled="!roomStore.isOwner || roomStore.loading" @click="startGame">
          开始对局
        </button>
      </section>

      <section v-if="room.status === 'playing'" class="panel">
        <div class="section-title">
          <h2>记一笔</h2>
          <button class="ghost-button danger" :disabled="!roomStore.isOwner || roomStore.loading" @click="undo">撤销</button>
        </div>
        <div class="grid two">
          <label>
            付款方
            <select v-model.number="transferForm.fromPlayerId">
              <option v-for="player in players" :key="player.id" :value="player.id">{{ player.nickname }}</option>
            </select>
          </label>
          <label>
            收款方
            <select v-model.number="transferForm.toPlayerId">
              <option v-for="player in players" :key="player.id" :value="player.id">{{ player.nickname }}</option>
            </select>
          </label>
        </div>
        <label>
          分数
          <input v-model.number="transferForm.amount" type="number" min="1" />
        </label>
        <div class="quick-grid">
          <button v-for="amount in quickAmounts" :key="amount" @click="transferForm.amount = amount">
            {{ amount }}
          </button>
        </div>
        <label>
          备注
          <input v-model="transferForm.remark" placeholder="点炮、杠分、其他" />
        </label>
        <button class="primary-button" :disabled="roomStore.loading" @click="submitTransfer">确认记分</button>
        <button class="secondary-button" :disabled="!roomStore.isOwner || roomStore.loading" @click="finish">结束结算</button>
      </section>

      <section v-if="room.status === 'finished'" class="panel">
        <h2>最终结算</h2>
        <div class="list">
          <div v-for="settlement in state.settlements" :key="settlement.id" class="settlement-row">
            <strong>{{ settlement.nickname }}</strong>
            <span :class="{ win: settlement.diffScore > 0, lose: settlement.diffScore < 0 }">
              {{ settlement.diffScore > 0 ? '+' : '' }}{{ settlement.diffScore }}
            </span>
            <small>{{ settlement.moneyAmount.toFixed(2) }}</small>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <h2>流水</h2>
          <span>{{ activeTransactions.length }} 笔</span>
        </div>
        <div v-if="!latestTransactions.length" class="empty">暂无流水</div>
        <div v-else class="timeline">
          <article v-for="item in latestTransactions" :key="item.id" :class="{ reverted: item.isReverted }">
            <strong>{{ item.fromNickname }} 给 {{ item.toNickname }} {{ item.amount }} 分</strong>
            <span>{{ item.remark || '无备注' }}</span>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>
