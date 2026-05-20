<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '../stores/room'

const router = useRouter()
const roomStore = useRoomStore()

const joinCode = ref('')
const defaultJoinNickname = createDefaultNickname()
const joinNickname = ref(defaultJoinNickname)
const nicknameUsingDefault = ref(true)

const joinErrors = reactive({
  code: '',
  nickname: ''
})

function clearJoinErrors() {
  joinErrors.code = ''
  joinErrors.nickname = ''
}

function validateJoinForm() {
  clearJoinErrors()
  applyJoinDefaults()
  if (!joinCode.value.trim()) {
    joinErrors.code = '请填写房间号'
  }
  if (!joinNickname.value.trim()) {
    joinErrors.nickname = '请填写玩家昵称'
  }
  return !joinErrors.code && !joinErrors.nickname
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

function createDefaultNickname() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `玩家${suffix}`
}

function applyJoinDefaults() {
  if (nicknameUsingDefault.value || !joinNickname.value.trim()) {
    joinNickname.value = defaultJoinNickname
    nicknameUsingDefault.value = true
  }
}

function clearDefaultNickname() {
  if (!nicknameUsingDefault.value) return
  joinNickname.value = ''
  nicknameUsingDefault.value = false
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar compact">
      <button class="icon-button" aria-label="返回首页" @click="router.push('/')">←</button>
      <div>
        <p class="eyebrow">进已有桌</p>
        <h1>加入房间</h1>
      </div>
    </header>

    <section class="panel">
      <div class="section-title">
        <h2>进入房间</h2>
        <span>等待房间可加入</span>
      </div>
      <label>
        房间号
        <input v-model.trim="joinCode" maxlength="6" placeholder="例如 A2B3C4" class="code-input" @input="joinErrors.code = ''" />
        <small v-if="joinErrors.code" class="field-error">{{ joinErrors.code }}</small>
      </label>
      <label>
        玩家昵称
        <input
          v-model="joinNickname"
          placeholder="你的昵称"
          @focus="clearDefaultNickname"
          @input="joinErrors.nickname = ''; nicknameUsingDefault = false"
        />
        <small v-if="joinErrors.nickname" class="field-error">{{ joinErrors.nickname }}</small>
      </label>
      <button class="primary-button" :disabled="roomStore.loading" @click="joinRoom">加入房间</button>
    </section>

    <p v-if="roomStore.error" class="error-text">{{ roomStore.error }}</p>
  </main>
</template>
