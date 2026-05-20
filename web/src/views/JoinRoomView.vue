<script setup lang="ts">
import { onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import jsQR from 'jsqr'
import { useRoomStore } from '../stores/room'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()

const joinCode = ref(normalizeRoomCode(String(route.query.code || '')))
const defaultJoinNickname = createDefaultNickname()
const joinNickname = ref('')
const scanning = ref(false)
const scanError = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let scanStream: MediaStream | null = null
let scanFrame = 0

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
  if (!joinCode.value.trim()) {
    joinErrors.code = '请填写房间号'
  }
  return !joinErrors.code && !joinErrors.nickname
}

async function joinRoom() {
  if (!validateJoinForm()) return
  try {
    const result = await roomStore.joinRoom(joinCode.value, joinNickname.value.trim() || defaultJoinNickname)
    router.push(`/room/${result.state.room.code}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('房间')) joinErrors.code = message
    else if (message.includes('昵称')) joinErrors.nickname = message
  }
}

function normalizeRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

function extractRoomCode(text: string) {
  const value = text.trim()

  try {
    const url = new URL(value, window.location.origin)
    const queryCode = url.searchParams.get('code')
    if (queryCode) return normalizeRoomCode(queryCode)
  } catch {
    // Plain room-code parsing below handles non-URL QR content.
  }

  return normalizeRoomCode(value.match(/[A-Z0-9]{6}/i)?.[0] || '')
}

async function openScanner() {
  scanError.value = ''

  if (!window.isSecureContext) {
    scanError.value = '浏览器摄像头扫码需要 HTTPS 或 localhost；也可以直接用系统相机扫描房主二维码'
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    scanError.value = '当前浏览器不支持调用摄像头扫码'
    return
  }

  scanning.value = true

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    })

    if (!videoRef.value) return
    videoRef.value.srcObject = scanStream
    await videoRef.value.play()
    scanFrame = window.requestAnimationFrame(scanQrFrame)
  } catch {
    closeScanner()
    scanError.value = '无法打开摄像头，请检查浏览器权限或使用系统相机扫码'
  }
}

function scanQrFrame() {
  const video = videoRef.value
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d', { willReadFrequently: true })

  if (!video || !canvas || !context || !scanning.value) return

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const result = jsQR(imageData.data, imageData.width, imageData.height)
    if (result?.data) {
      const roomCode = extractRoomCode(result.data)
      if (roomCode) {
        joinCode.value = roomCode
        joinErrors.code = ''
        closeScanner()
        return
      }

      scanError.value = '未识别到有效房间号，请确认二维码来自雀桌记'
    }
  }

  scanFrame = window.requestAnimationFrame(scanQrFrame)
}

function closeScanner() {
  scanning.value = false
  if (scanFrame) {
    window.cancelAnimationFrame(scanFrame)
    scanFrame = 0
  }
  scanStream?.getTracks().forEach((track) => track.stop())
  scanStream = null
}

function createDefaultNickname() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `玩家${suffix}`
}

onUnmounted(closeScanner)
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
        <input
          v-model="joinCode"
          maxlength="6"
          placeholder="例如 A2B3C4"
          class="code-input"
          @input="joinCode = normalizeRoomCode(joinCode); joinErrors.code = ''"
        />
        <small v-if="joinErrors.code" class="field-error">{{ joinErrors.code }}</small>
      </label>
      <label>
        玩家昵称
        <input
          v-model="joinNickname"
          :placeholder="defaultJoinNickname"
          @input="joinErrors.nickname = ''"
        />
        <small v-if="joinErrors.nickname" class="field-error">{{ joinErrors.nickname }}</small>
      </label>
      <div class="action-grid two">
        <button class="primary-button" :disabled="roomStore.loading" @click="joinRoom">加入房间</button>
        <button class="secondary-button" type="button" @click="openScanner">扫码填写</button>
      </div>
      <small v-if="scanError && !scanning" class="field-error">{{ scanError }}</small>
    </section>

    <p v-if="roomStore.error" class="error-text">{{ roomStore.error }}</p>

    <div v-if="scanning" class="modal-backdrop">
      <section class="modal-panel scanner-panel">
        <h2>扫描房间二维码</h2>
        <p class="modal-message">将房主展示的二维码放入取景框，识别后会自动填写房间号。</p>
        <video ref="videoRef" class="scanner-video" muted playsinline></video>
        <canvas ref="canvasRef" class="hidden-canvas"></canvas>
        <small v-if="scanError" class="field-error form-error">{{ scanError }}</small>
        <button class="ghost-button modal-close" type="button" @click="closeScanner">取消扫码</button>
      </section>
    </div>
  </main>
</template>
