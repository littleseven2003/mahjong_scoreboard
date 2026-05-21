<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const CLOSE_DELAY_SECONDS = 5

const noticeOpen = ref(false)
const secondsLeft = ref(CLOSE_DELAY_SECONDS)
const noticeForced = ref(false)
let countdownTimer: number | null = null

const closeDisabled = computed(() => noticeForced.value && secondsLeft.value > 0)
const closeText = computed(() => closeDisabled.value ? `${secondsLeft.value} 秒后可关闭` : '我已了解')

function startCountdown() {
  secondsLeft.value = CLOSE_DELAY_SECONDS
  if (countdownTimer) window.clearInterval(countdownTimer)
  countdownTimer = window.setInterval(() => {
    secondsLeft.value = Math.max(0, secondsLeft.value - 1)
    if (secondsLeft.value === 0 && countdownTimer) {
      window.clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function openNotice(force = false) {
  noticeForced.value = force
  noticeOpen.value = true
  if (force) {
    startCountdown()
    return
  }
  secondsLeft.value = 0
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function closeNotice() {
  if (closeDisabled.value) return
  noticeOpen.value = false
}

function handleManualNotice() {
  openNotice(false)
}

onMounted(() => {
  window.addEventListener('quezhuoji:open-user-notice', handleManualNotice)
  openNotice(true)
})

onUnmounted(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
  }
  window.removeEventListener('quezhuoji:open-user-notice', handleManualNotice)
})
</script>

<template>
  <RouterView />

  <div v-if="noticeOpen" class="modal-backdrop">
    <section class="modal-panel notice-panel">
      <p class="eyebrow">特别测试版本</p>
      <h2>用户须知</h2>
      <p class="modal-message">
        当前部署仅用于展示雀桌记实验功能与软件学习测试，不代表正式生产服务。
      </p>
      <div class="notice-list">
        <article>
          <strong>使用范围</strong>
          <span>本软件仅用于家庭娱乐中的积分记录、结算辅助和软件学习，禁止用于赌博、资金结算、牟利活动或其他违法违规用途。</span>
        </article>
        <article>
          <strong>数据提示</strong>
          <span>使用过程中可能产生并保存房间号、房间名、玩家昵称、玩家加入时间、牌局创建/开始/结束时间、记分流水、备注和结算数据；服务端访问日志还可能记录访问来源地址、请求时间等运行信息。</span>
        </article>
        <article>
          <strong>风险声明</strong>
          <span>当前测试部署不承诺数据长期保存、完整可用或绝对安全。因使用本测试部署产生的数据泄露、丢失、误删、服务不可用等风险，由使用者自行评估和承担。</span>
        </article>
        <article>
          <strong>责任边界</strong>
          <span>使用者应遵守所在地法律法规。因使用本软件产生的任何人身、财产、牌局争议、违法违规后果或第三方纠纷，软件作者和测试部署提供者不承担责任。</span>
        </article>
        <article>
          <strong>开源协议</strong>
          <span>本软件遵循 GPL-3.0 开源协议。未经合规授权，不得将本软件用于商业售卖、封闭分发或其他违反开源协议的用途；如进行二次开发、修改或再分发，应继续遵守相应开源协议要求。</span>
        </article>
      </div>
      <button class="primary-button" :disabled="closeDisabled" @click="closeNotice">{{ closeText }}</button>
    </section>
  </div>
</template>
