<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type AdminMaintenanceSettings, type AdminRoom, type AdminSummary, type RoomState } from '../api/client'

const router = useRouter()
const token = ref(sessionStorage.getItem('mahjong_scoreboard_admin_token') || '')
const summary = ref<AdminSummary | null>(null)
const rooms = ref<AdminRoom[]>([])
const selectedRoom = ref<RoomState | null>(null)
const selectedRoomId = ref<number | null>(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const deleteTarget = ref<AdminRoom | null>(null)
const savedMaintenance = ref<AdminMaintenanceSettings>({
  cleanupEnabled: false,
  cleanupFinishedDays: 30,
  cleanupIntervalHours: 24
})
const maintenanceForm = reactive<AdminMaintenanceSettings>({
  cleanupEnabled: false,
  cleanupFinishedDays: 30,
  cleanupIntervalHours: 24
})

const statusText = {
  waiting: '等待开局',
  playing: '进行中',
  finished: '已结算'
}

const sortedRooms = computed(() => rooms.value)
const currentMaintenance = computed(() => savedMaintenance.value)
const cleanupStatusText = computed(() => currentMaintenance.value.cleanupEnabled ? '运行中' : '未启用')
const cleanupScopeText = computed(() =>
  currentMaintenance.value.cleanupEnabled ? `已结算且超过 ${currentMaintenance.value.cleanupFinishedDays} 天的对局` : '未启用'
)
const cleanupIntervalText = computed(() =>
  currentMaintenance.value.cleanupEnabled ? `每 ${currentMaintenance.value.cleanupIntervalHours} 小时检查一次` : '未启用'
)

function requireToken() {
  if (!token.value) {
    router.replace('/')
    return false
  }
  return true
}

function applyMaintenance(settings: AdminMaintenanceSettings) {
  savedMaintenance.value = { ...settings }
  maintenanceForm.cleanupEnabled = settings.cleanupEnabled
  maintenanceForm.cleanupFinishedDays = settings.cleanupFinishedDays
  maintenanceForm.cleanupIntervalHours = settings.cleanupIntervalHours
}

async function loadAdminData() {
  if (!requireToken()) return
  loading.value = true
  error.value = ''
  try {
    const [nextSummary, nextRooms] = await Promise.all([
      api.adminSummary(token.value),
      api.adminRooms(token.value)
    ])
    summary.value = nextSummary
    rooms.value = nextRooms
    applyMaintenance(nextSummary.maintenance)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '载入管理数据失败'
    if (error.value.includes('登录')) logout()
  } finally {
    loading.value = false
  }
}

async function selectRoom(room: AdminRoom) {
  if (!requireToken()) return
  selectedRoomId.value = room.id
  selectedRoom.value = null
  error.value = ''
  try {
    selectedRoom.value = await api.adminRoomDetail(token.value, room.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读取对局详情失败'
  }
}

async function saveMaintenance() {
  if (!requireToken()) return
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const payload = {
      cleanupEnabled: Boolean(maintenanceForm.cleanupEnabled),
      cleanupFinishedDays: Number(maintenanceForm.cleanupFinishedDays),
      cleanupIntervalHours: Number(maintenanceForm.cleanupIntervalHours)
    }
    const settings = await api.updateAdminMaintenance(token.value, {
      cleanupEnabled: payload.cleanupEnabled,
      cleanupFinishedDays: payload.cleanupFinishedDays,
      cleanupIntervalHours: payload.cleanupIntervalHours
    })
    applyMaintenance(settings)
    notice.value = '清理任务配置已保存'
    const nextSummary = await api.adminSummary(token.value)
    summary.value = nextSummary
    savedMaintenance.value = { ...settings }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存配置失败'
  } finally {
    loading.value = false
  }
}

async function runCleanup() {
  if (!requireToken()) return
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await api.runAdminCleanup(token.value)
    notice.value = `已清理 ${result.deletedCount} 个过期已结算对局`
    await loadAdminData()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '执行清理失败'
  } finally {
    loading.value = false
  }
}

async function confirmDeleteRoom() {
  if (!requireToken() || !deleteTarget.value) return
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    await api.deleteAdminRoom(token.value, deleteTarget.value.id)
    notice.value = `已删除对局 ${deleteTarget.value.code}`
    deleteTarget.value = null
    selectedRoom.value = null
    selectedRoomId.value = null
    await loadAdminData()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除对局失败'
  } finally {
    loading.value = false
  }
}

function logout() {
  sessionStorage.removeItem('mahjong_scoreboard_admin_token')
  token.value = ''
  router.replace('/')
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '未记录'
}

onMounted(loadAdminData)
</script>

<template>
  <main class="app-shell admin-shell">
    <header class="topbar compact">
      <RouterLink class="ghost-button icon-button" to="/">←</RouterLink>
      <div>
        <p class="eyebrow">实验功能</p>
        <h1>管理中心</h1>
      </div>
      <button class="ghost-button" type="button" @click="logout">退出</button>
    </header>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="notice" class="notice-text">{{ notice }}</p>

    <section class="admin-metrics">
      <article>
        <span>对局</span>
        <strong>{{ summary?.rooms ?? '-' }}</strong>
      </article>
      <article>
        <span>玩家</span>
        <strong>{{ summary?.players ?? '-' }}</strong>
      </article>
      <article>
        <span>流水</span>
        <strong>{{ summary?.transactions ?? '-' }}</strong>
      </article>
      <article>
        <span>结算</span>
        <strong>{{ summary?.settlements ?? '-' }}</strong>
      </article>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>定时清理</h2>
        <span>{{ cleanupStatusText }}</span>
      </div>
      <div class="maintenance-overview">
        <article>
          <span>当前状态</span>
          <strong>{{ cleanupStatusText }}</strong>
        </article>
        <article>
          <span>清理范围</span>
          <strong>{{ cleanupScopeText }}</strong>
        </article>
        <article>
          <span>执行频率</span>
          <strong>{{ cleanupIntervalText }}</strong>
        </article>
      </div>
      <div class="maintenance-editor">
        <label class="toggle-card">
          <input v-model="maintenanceForm.cleanupEnabled" type="checkbox">
          <span>
            <strong>启用自动清理</strong>
            <small>只清理已结算对局，不影响等待中或进行中的房间。</small>
          </span>
        </label>
        <div class="form-grid two">
          <label>
            <span>已结束对局保留天数</span>
            <input
              v-model.number="maintenanceForm.cleanupFinishedDays"
              type="number"
              min="1"
              max="3650"
              :disabled="!maintenanceForm.cleanupEnabled"
            >
          </label>
          <label>
            <span>自动检查间隔（小时）</span>
            <input
              v-model.number="maintenanceForm.cleanupIntervalHours"
              type="number"
              min="1"
              max="720"
              :disabled="!maintenanceForm.cleanupEnabled"
            >
          </label>
        </div>
        <div class="action-grid two">
          <button class="primary-button" :disabled="loading" @click="saveMaintenance">保存清理配置</button>
          <button class="secondary-button" :disabled="loading" @click="runCleanup">按当前配置立即清理</button>
        </div>
      </div>
      <p class="helper-text">当前仅自动清理已结算且超过保留天数的对局。直接删除单条数据需要在下方手动确认。</p>
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>数据库对局</h2>
        <span>{{ loading ? '读取中' : `${rooms.length} 条` }}</span>
      </div>
      <div v-if="!sortedRooms.length" class="empty">暂无对局数据</div>
      <div v-else class="admin-room-list">
        <article
          v-for="room in sortedRooms"
          :key="room.id"
          class="admin-room-item"
          :class="{ active: selectedRoomId === room.id }"
        >
          <button type="button" @click="selectRoom(room)">
            <strong>{{ room.name || room.code }}</strong>
            <span>{{ room.code }} · {{ statusText[room.status] }} · {{ room.playerCount }}/{{ room.configuredPlayerCount }} 人</span>
            <small>{{ room.playerNames || '暂无玩家' }}</small>
          </button>
          <button class="ghost-button danger compact-button" type="button" @click="deleteTarget = room">删除</button>
        </article>
      </div>
    </section>

    <section v-if="selectedRoom" class="panel">
      <div class="section-title">
        <h2>对局详情</h2>
        <span>{{ selectedRoom.room.code }}</span>
      </div>
      <div class="admin-detail-grid">
        <span>状态</span>
        <strong>{{ statusText[selectedRoom.room.status] }}</strong>
        <span>创建时间</span>
        <strong>{{ formatTime(selectedRoom.room.createdAt) }}</strong>
        <span>开始时间</span>
        <strong>{{ formatTime(selectedRoom.room.startedAt) }}</strong>
        <span>结束时间</span>
        <strong>{{ formatTime(selectedRoom.room.finishedAt) }}</strong>
      </div>
      <div class="admin-subsection">
        <h3>玩家</h3>
        <div class="list">
          <div v-for="player in selectedRoom.players" :key="player.id" class="list-row">
            <span>{{ player.seatNo }} 位</span>
            <strong>{{ player.nickname }}</strong>
            <small>{{ player.currentScore }}</small>
          </div>
        </div>
      </div>
      <div class="admin-subsection">
        <h3>流水</h3>
        <div v-if="!selectedRoom.transactions.length" class="empty">暂无流水</div>
        <div v-else class="timeline">
          <article v-for="item in selectedRoom.transactions" :key="item.id" :class="{ reverted: item.isReverted }">
            <strong>{{ item.fromNickname }} → {{ item.toNickname }}</strong>
            <span>{{ item.amount }} 分 · {{ item.remark || '无备注' }}</span>
          </article>
        </div>
      </div>
    </section>

    <div v-if="deleteTarget" class="modal-backdrop">
      <section class="modal-panel">
        <h2>删除对局</h2>
        <p class="modal-message">删除后会同时删除该对局的玩家、流水和结算数据，此操作不可恢复。</p>
        <div class="confirm-summary">
          <span>房间</span>
          <strong>{{ deleteTarget.name || deleteTarget.code }}</strong>
          <span>房间号</span>
          <strong>{{ deleteTarget.code }}</strong>
        </div>
        <button class="primary-button danger-fill" :disabled="loading" @click="confirmDeleteRoom">确认删除</button>
        <button class="ghost-button modal-close" :disabled="loading" @click="deleteTarget = null">取消</button>
      </section>
    </div>
  </main>
</template>
