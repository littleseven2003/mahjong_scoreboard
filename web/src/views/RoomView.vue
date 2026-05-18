<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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
const visibleTransactions = computed(() => activeTransactions.value)
const dismissedUndoIds = ref<number[]>([])
const undoDialogTransactionId = ref<number | null>(null)
const allReadyNotified = ref(false)
type PromptDialog = {
  title: string
  message: string
  confirmText: string
  cancelText?: string
  closeText?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  onClose?: () => void
}

const promptDialog = ref<PromptDialog | null>(null)

const transferForm = reactive({
  fromPlayerId: 0,
  toPlayerId: 0,
  amount: 10,
  remark: ''
})
const transferErrors = reactive({
  amount: '',
  players: ''
})

const quickAmounts = [1, 2, 5, 10, 20, 50, 100]

const fromOptions = computed(() => {
  if (!roomStore.isOwner && roomStore.playerId) {
    return players.value.filter((player) => player.id === roomStore.playerId)
  }
  return players.value.filter((player) => player.id !== transferForm.toPlayerId)
})

const toOptions = computed(() =>
  players.value.filter((player) => player.id !== transferForm.fromPlayerId)
)

const selectedUndoTransaction = computed(() =>
  activeTransactions.value.find((item) => item.id === undoDialogTransactionId.value) || null
)

const pendingUndoForMe = computed(() =>
  activeTransactions.value.find((item) => shouldShowUndoDialog(item) && !dismissedUndoIds.value.includes(item.id)) || null
)
const nonOwnerPlayers = computed(() => players.value.filter((player) => !player.isOwner))
const readyPlayers = computed(() => nonOwnerPlayers.value.filter((player) => player.isReady))
const roomIsFull = computed(() => Boolean(room.value && players.value.length >= room.value.playerCount))
const allNonOwnersReady = computed(() =>
  roomIsFull.value && nonOwnerPlayers.value.length > 0 && readyPlayers.value.length === nonOwnerPlayers.value.length
)

onMounted(() => {
  roomStore.loadRoom(code.value)
  window.addEventListener('mahjong:room-disbanded', handleRoomDisbanded)
})

onUnmounted(() => {
  window.removeEventListener('mahjong:room-disbanded', handleRoomDisbanded)
})

watch(players, (nextPlayers) => {
  if (!nextPlayers.length) return

  if (!roomStore.isOwner && roomStore.playerId) {
    transferForm.fromPlayerId = roomStore.playerId
  } else if (!fromOptions.value.some((player) => player.id === transferForm.fromPlayerId)) {
    transferForm.fromPlayerId = fromOptions.value[0]?.id || nextPlayers[0].id
  }

  if (!toOptions.value.some((player) => player.id === transferForm.toPlayerId)) {
    transferForm.toPlayerId = toOptions.value[0]?.id || 0
  }
}, { immediate: true })

watch(pendingUndoForMe, (item) => {
  if (item && !undoDialogTransactionId.value) {
    undoDialogTransactionId.value = item.id
  }
})

watch(() => transferForm.fromPlayerId, () => {
  transferErrors.players = ''
  if (transferForm.toPlayerId === transferForm.fromPlayerId) {
    transferForm.toPlayerId = toOptions.value[0]?.id || 0
  }
})

watch(() => transferForm.toPlayerId, () => {
  transferErrors.players = ''
  if (transferForm.fromPlayerId === transferForm.toPlayerId) {
    transferForm.fromPlayerId = fromOptions.value[0]?.id || 0
  }
})

watch([allNonOwnersReady, room, () => roomStore.isOwner], ([isReady, nextRoom, isOwner]) => {
  if (!nextRoom || nextRoom.status !== 'waiting' || !isOwner) return

  if (isReady && !allReadyNotified.value) {
    allReadyNotified.value = true
    openNotice('准备完成', '所有玩家已准备完毕，可以开始对局了')
  }

  if (!isReady) {
    allReadyNotified.value = false
  }
})

function handleRoomDisbanded(event: Event) {
  const detail = (event as CustomEvent<{ message: string }>).detail
  openNotice('房间已解散', detail?.message || '房间已解散', () => {
    router.push('/')
  })
}

function openNotice(title: string, message: string, onConfirm?: () => void) {
  promptDialog.value = {
    title,
    message,
    confirmText: '知道了',
    onConfirm: () => {
      promptDialog.value = null
      onConfirm?.()
    }
  }
}

function openConfirm(options: Omit<PromptDialog, 'onClose'>) {
  promptDialog.value = {
    ...options,
    onCancel: async () => {
      if (options.onCancel) await options.onCancel()
      promptDialog.value = null
    }
  }
}

async function confirmPrompt() {
  const dialog = promptDialog.value
  if (!dialog) return
  await dialog.onConfirm()
  promptDialog.value = null
}

async function cancelPrompt() {
  const dialog = promptDialog.value
  if (!dialog?.onCancel) {
    promptDialog.value = null
    return
  }
  await dialog.onCancel()
}

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

async function toggleReady() {
  const currentPlayer = roomStore.currentPlayer
  if (!ensurePlayer() || roomStore.isOwner || !currentPlayer) return
  await roomStore.applyAction(() => api.setReady(code.value, roomStore.playerId!, !currentPlayer.isReady))
}

async function leaveRoom() {
  if (!ensurePlayer()) return
  openConfirm({
    title: '退出房间',
    message: '退出后当前昵称会释放，其他设备可以用这个昵称重新加入。',
    confirmText: '确认退出',
    cancelText: '暂不退出',
    danger: true,
    onConfirm: async () => {
      await roomStore.applyAction(() => api.leaveRoom(code.value, roomStore.playerId!))
      roomStore.clearPlayerId(code.value)
      router.push('/')
    }
  })
}

async function disbandRoom() {
  if (!ensurePlayer() || !roomStore.isOwner) return
  openConfirm({
    title: '解散房间',
    message: '解散房间会让所有玩家收到提示并回到首页。',
    confirmText: '确认解散',
    cancelText: '暂不解散',
    danger: true,
    onConfirm: async () => {
      await api.disbandRoom(code.value, roomStore.playerId!)
      roomStore.clearPlayerId(code.value)
      router.push('/')
    }
  })
}

async function submitTransfer() {
  if (!ensurePlayer()) return
  transferErrors.amount = ''
  transferErrors.players = ''

  if (!transferForm.fromPlayerId || !transferForm.toPlayerId || transferForm.fromPlayerId === transferForm.toPlayerId) {
    transferErrors.players = '请选择不同的扣分玩家和加分玩家'
    return
  }

  const amount = Number(transferForm.amount)
  if (!Number.isInteger(amount) || amount <= 0) {
    transferErrors.amount = '分数必须是正整数'
    return
  }

  await roomStore.applyAction(() => api.transferScore(code.value, {
    ...transferForm,
    createdBy: roomStore.playerId
  }))
  transferForm.remark = ''
}

function playerOptionLabel(player: { id: number; nickname: string }) {
  return player.id === roomStore.playerId ? `${player.nickname}（自己）` : player.nickname
}

function addQuickAmount(amount: number) {
  transferErrors.amount = ''
  transferForm.amount = Math.max(0, Number(transferForm.amount || 0) + amount)
}

function clearAmount() {
  transferErrors.amount = ''
  transferForm.amount = 0
}

function canConfirmUndo(item: { fromPlayerId: number; toPlayerId: number; isReverted: boolean }) {
  return room.value?.status === 'playing'
    && !item.isReverted
    && (item.fromPlayerId === roomStore.playerId || item.toPlayerId === roomStore.playerId)
}

function shouldShowUndoDialog(item: {
  fromPlayerId: number
  toPlayerId: number
  isReverted: boolean
  undoRequestedAt: string | null
  undoFromConfirmedAt: string | null
  undoToConfirmedAt: string | null
}) {
  if (room.value?.status !== 'playing' || item.isReverted || !item.undoRequestedAt) return false
  if (item.fromPlayerId === roomStore.playerId) return !item.undoFromConfirmedAt
  if (item.toPlayerId === roomStore.playerId) return !item.undoToConfirmedAt
  return false
}

function undoStatus(item: {
  isReverted: boolean
  undoRequestedAt: string | null
  undoFromConfirmedAt: string | null
  undoToConfirmedAt: string | null
}) {
  if (item.isReverted) return '已撤销'
  if (!item.undoRequestedAt) return '未申请撤销'
  const fromDone = item.undoFromConfirmedAt ? '扣分方已确认' : '扣分方待确认'
  const toDone = item.undoToConfirmedAt ? '加分方已确认' : '加分方待确认'
  return `${fromDone} / ${toDone}`
}

function openUndoDialog(transactionId: number) {
  undoDialogTransactionId.value = transactionId
  dismissedUndoIds.value = dismissedUndoIds.value.filter((id) => id !== transactionId)
}

function closeUndoDialogTemporarily() {
  if (undoDialogTransactionId.value) {
    dismissedUndoIds.value = [...new Set([...dismissedUndoIds.value, undoDialogTransactionId.value])]
  }
  undoDialogTransactionId.value = null
}

async function confirmUndo(transactionId: number) {
  if (!ensurePlayer()) return
  await roomStore.applyAction(() => api.confirmUndo(code.value, transactionId, roomStore.playerId!))
  undoDialogTransactionId.value = null
}

async function cancelUndo(transactionId: number) {
  if (!ensurePlayer()) return
  await roomStore.applyAction(() => api.cancelUndo(code.value, transactionId, roomStore.playerId!))
  dismissedUndoIds.value = dismissedUndoIds.value.filter((id) => id !== transactionId)
  undoDialogTransactionId.value = null
}

async function finish() {
  if (!ensurePlayer()) return
  openConfirm({
    title: '结束结算',
    message: '结束后会生成最终结算，房间进入已结束状态。',
    confirmText: '确认结束',
    cancelText: '继续记分',
    onConfirm: async () => {
      await roomStore.applyAction(() => api.finish(code.value, roomStore.playerId!))
    }
  })
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
        <p v-if="roomStore.isOwner && allNonOwnersReady" class="notice-text">所有玩家已准备完毕，可以开始对局了</p>
        <div class="list">
          <div v-for="player in players" :key="player.id" class="list-row">
            <span>{{ player.seatNo }} 位</span>
            <strong>{{ player.nickname }}</strong>
            <small v-if="player.isOwner">房主</small>
            <small v-else :class="{ ready: player.isReady }">{{ player.isReady ? '已准备' : '未准备' }}</small>
          </div>
        </div>
        <button
          v-if="roomStore.isOwner"
          class="primary-button"
          :disabled="!allNonOwnersReady || roomStore.loading"
          @click="startGame"
        >
          开始对局
        </button>
        <button v-if="roomStore.isOwner" class="secondary-button danger-outline" :disabled="roomStore.loading" @click="disbandRoom">
          解散房间
        </button>
        <template v-else>
          <button class="primary-button" :disabled="roomStore.loading" @click="toggleReady">
            {{ roomStore.currentPlayer?.isReady ? '取消准备' : '准备' }}
          </button>
          <button class="secondary-button danger-outline" :disabled="roomStore.loading" @click="leaveRoom">
            退出房间
          </button>
        </template>
      </section>

      <section v-if="room.status === 'playing'" class="panel">
        <div class="section-title">
          <h2>记一笔</h2>
        </div>
        <div class="grid two">
          <label>
            扣分玩家
            <select v-model.number="transferForm.fromPlayerId" :disabled="!roomStore.isOwner">
              <option v-for="player in fromOptions" :key="player.id" :value="player.id">{{ playerOptionLabel(player) }}</option>
            </select>
          </label>
          <label>
            加分玩家
            <select v-model.number="transferForm.toPlayerId">
              <option v-for="player in toOptions" :key="player.id" :value="player.id">{{ playerOptionLabel(player) }}</option>
            </select>
          </label>
        </div>
        <small v-if="transferErrors.players" class="field-error form-error">{{ transferErrors.players }}</small>
        <label>
          分数
          <input v-model.number="transferForm.amount" type="number" min="1" @input="transferErrors.amount = ''" />
          <small v-if="transferErrors.amount" class="field-error">{{ transferErrors.amount }}</small>
        </label>
        <div class="quick-grid">
          <button type="button" @click="clearAmount">清零</button>
          <button v-for="amount in quickAmounts" :key="amount" type="button" @click="addQuickAmount(amount)">
            +{{ amount }}
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
        <div v-if="!visibleTransactions.length" class="empty">暂无流水</div>
        <div v-else class="timeline">
          <article v-for="item in visibleTransactions" :key="item.id" :class="{ reverted: item.isReverted, pending: item.undoRequestedAt && !item.isReverted }">
            <div class="timeline-main">
              <strong>{{ item.fromNickname }} 扣 {{ item.amount }} 分，{{ item.toNickname }} 加 {{ item.amount }} 分</strong>
              <span>{{ item.remark || '无备注' }}</span>
              <small>{{ undoStatus(item) }}</small>
            </div>
            <button
              v-if="canConfirmUndo(item)"
              class="ghost-button danger compact-button"
              :disabled="roomStore.loading"
              @click="item.undoRequestedAt ? openUndoDialog(item.id) : confirmUndo(item.id)"
            >
              {{ item.undoRequestedAt ? '处理撤销' : '申请撤销' }}
            </button>
          </article>
        </div>
      </section>

      <div v-if="selectedUndoTransaction" class="modal-backdrop">
        <section class="modal-panel">
          <h2>撤销确认</h2>
          <div class="undo-detail">
            <span>扣分玩家</span>
            <strong>{{ selectedUndoTransaction.fromNickname }}</strong>
            <span>加分玩家</span>
            <strong>{{ selectedUndoTransaction.toNickname }}</strong>
            <span>分数</span>
            <strong>{{ selectedUndoTransaction.amount }}</strong>
            <span>备注</span>
            <strong>{{ selectedUndoTransaction.remark || '无备注' }}</strong>
          </div>
          <button class="primary-button" :disabled="roomStore.loading" @click="confirmUndo(selectedUndoTransaction.id)">
            确认撤销
          </button>
          <button class="secondary-button danger-outline" :disabled="roomStore.loading" @click="cancelUndo(selectedUndoTransaction.id)">
            取消撤销
          </button>
          <button class="ghost-button modal-close" @click="closeUndoDialogTemporarily">暂时关闭</button>
        </section>
      </div>
    </template>

    <div v-if="promptDialog" class="modal-backdrop">
      <section class="modal-panel">
        <h2>{{ promptDialog.title }}</h2>
        <p class="modal-message">{{ promptDialog.message }}</p>
        <button class="primary-button" :class="{ 'danger-fill': promptDialog.danger }" :disabled="roomStore.loading" @click="confirmPrompt">
          {{ promptDialog.confirmText }}
        </button>
        <button v-if="promptDialog.cancelText" class="secondary-button" :disabled="roomStore.loading" @click="cancelPrompt">
          {{ promptDialog.cancelText }}
        </button>
      </section>
    </div>
  </main>
</template>
