<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const NOTICE_DATE_KEY = 'quezhuoji_admin_alpha_notice_date'
const NOTICE_SUPPRESS_UNTIL_KEY = 'quezhuoji_admin_alpha_notice_suppress_until'
const CLOSE_DELAY_SECONDS = 5
const SUPPRESS_DAYS = 7

const noticeOpen = ref(false)
const secondsLeft = ref(CLOSE_DELAY_SECONDS)
const suppressNotice = ref(false)
let countdownTimer: number | null = null

const closeDisabled = computed(() => secondsLeft.value > 0)
const closeText = computed(() => closeDisabled.value ? `${secondsLeft.value} 秒后可关闭` : '我已了解')

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function shouldShowNotice() {
  const suppressUntil = Number(localStorage.getItem(NOTICE_SUPPRESS_UNTIL_KEY) || 0)
  if (suppressUntil && Date.now() < suppressUntil) return false

  return localStorage.getItem(NOTICE_DATE_KEY) !== todayKey()
}

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

function closeNotice() {
  if (closeDisabled.value) return

  localStorage.setItem(NOTICE_DATE_KEY, todayKey())
  if (suppressNotice.value) {
    localStorage.setItem(
      NOTICE_SUPPRESS_UNTIL_KEY,
      String(Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000)
    )
  }
  noticeOpen.value = false
}

onMounted(() => {
  if (shouldShowNotice()) {
    noticeOpen.value = true
    startCountdown()
  }
})

onUnmounted(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
  }
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
      </div>
      <label class="check-row notice-check">
        <input v-model="suppressNotice" type="checkbox">
        <span>7 天内不再显示</span>
      </label>
      <button class="primary-button" :disabled="closeDisabled" @click="closeNotice">{{ closeText }}</button>
    </section>
  </div>
</template>
