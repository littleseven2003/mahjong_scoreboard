<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
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

const createErrors = reactive({
  ownerNickname: '',
  initialScore: '',
  scoreRate: ''
})

function clearCreateErrors() {
  createErrors.ownerNickname = ''
  createErrors.initialScore = ''
  createErrors.scoreRate = ''
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
</script>

<template>
  <main class="app-shell">
    <header class="topbar compact">
      <button class="icon-button" aria-label="返回首页" @click="router.push('/')">←</button>
      <div>
        <p class="eyebrow">开新桌</p>
        <h1>创建房间</h1>
      </div>
    </header>

    <section class="panel">
      <div class="section-title">
        <h2>房间设置</h2>
        <span>房主自动入座</span>
      </div>
      <div class="segmented">
        <button :class="{ active: createForm.playerCount === 3 }" @click="createForm.playerCount = 3">三人</button>
        <button :class="{ active: createForm.playerCount === 4 }" @click="createForm.playerCount = 4">四人</button>
      </div>
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

    <p v-if="roomStore.error" class="error-text">{{ roomStore.error }}</p>
  </main>
</template>
