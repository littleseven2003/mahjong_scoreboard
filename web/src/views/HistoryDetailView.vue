<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type RoomState } from '../api/client'

const route = useRoute()
const state = ref<RoomState | null>(null)
const error = ref('')

onMounted(async () => {
  try {
    state.value = await api.historyDetail(String(route.params.id))
  } catch (message) {
    error.value = message instanceof Error ? message.message : '历史详情加载失败'
  }
})
</script>

<template>
  <main class="app-shell">
    <header class="topbar compact">
      <RouterLink class="icon-button" to="/history">←</RouterLink>
      <div>
        <p class="eyebrow">历史详情</p>
        <h1>{{ state?.room.name || state?.room.code || '对局' }}</h1>
      </div>
    </header>

    <p v-if="error" class="error-text">{{ error }}</p>
    <template v-if="state">
      <section class="panel">
        <h2>结算</h2>
        <div class="list">
          <div v-for="settlement in state.settlements" :key="settlement.id" class="settlement-row">
            <strong>{{ settlement.nickname }}</strong>
            <span :class="{ win: settlement.diffScore > 0, lose: settlement.diffScore < 0 }">
              {{ settlement.diffScore > 0 ? '+' : '' }}{{ settlement.diffScore }}
            </span>
            <small>{{ settlement.finalScore }}</small>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>完整流水</h2>
        <div v-if="!state.transactions.length" class="empty">暂无流水</div>
        <div v-else class="timeline">
          <article v-for="item in state.transactions" :key="item.id" :class="{ reverted: item.isReverted }">
            <strong>{{ item.fromNickname }} 扣 {{ item.amount }} 分，{{ item.toNickname }} 加 {{ item.amount }} 分</strong>
            <span>{{ item.remark || '无备注' }}</span>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>
