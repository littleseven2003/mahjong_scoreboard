<script setup lang="ts">
import { reactive, ref } from 'vue'
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

const joinCode = ref('')
const joinNickname = ref('')

async function createRoom() {
  const result = await roomStore.createRoom(createForm)
  router.push(`/room/${result.state.room.code}`)
}

async function joinRoom() {
  const result = await roomStore.joinRoom(joinCode.value, joinNickname.value)
  router.push(`/room/${result.state.room.code}`)
}
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

    <section class="panel">
      <h2>创建房间</h2>
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
        <input v-model="createForm.ownerNickname" placeholder="你的昵称" />
      </label>
      <div class="grid two">
        <label>
          起始分
          <input v-model.number="createForm.initialScore" type="number" min="1" />
        </label>
        <label>
          计分单位
          <input v-model.number="createForm.scoreRate" type="number" min="0.1" step="0.1" />
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
        <input v-model.trim="joinCode" maxlength="6" placeholder="例如 A2B3C4" class="code-input" />
      </label>
      <label>
        玩家昵称
        <input v-model="joinNickname" placeholder="你的昵称" />
      </label>
      <button class="secondary-button" :disabled="roomStore.loading" @click="joinRoom">加入房间</button>
    </section>

    <p v-if="roomStore.error" class="error-text">{{ roomStore.error }}</p>
  </main>
</template>
