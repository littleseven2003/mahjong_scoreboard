import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, getSocket, type RoomState } from '../api/client'

const PLAYER_KEY_PREFIX = 'mahjong_scoreboard_player_'

export const useRoomStore = defineStore('room', () => {
  const state = ref<RoomState | null>(null)
  const playerId = ref<number | null>(null)
  const loading = ref(false)
  const error = ref('')
  const connectedCode = ref('')

  const currentPlayer = computed(() =>
    state.value?.players.find((player) => player.id === playerId.value) || null
  )
  const isOwner = computed(() => Boolean(currentPlayer.value?.isOwner))

  function setError(message: unknown) {
    error.value = message instanceof Error ? message.message : String(message || '操作失败')
  }

  function storePlayerId(code: string, id: number) {
    playerId.value = id
    localStorage.setItem(`${PLAYER_KEY_PREFIX}${code.toUpperCase()}`, String(id))
  }

  function restorePlayerId(code: string) {
    const stored = localStorage.getItem(`${PLAYER_KEY_PREFIX}${code.toUpperCase()}`)
    playerId.value = stored ? Number(stored) : null
  }

  function connectRoom(code: string) {
    const normalized = code.toUpperCase()
    const socket = getSocket()
    if (connectedCode.value && connectedCode.value !== normalized) {
      socket.emit('room:leave', { roomCode: connectedCode.value })
    }

    connectedCode.value = normalized
    socket.off('room:sync')
    socket.off('room:disbanded')
    socket.off('connect', rejoinConnectedRoom)
    socket.on('room:sync', (nextState: RoomState) => {
      if (nextState.room.code === connectedCode.value) {
        state.value = nextState
      }
    })
    socket.on('room:disbanded', ({ roomCode, message }: { roomCode: string; message: string }) => {
      if (String(roomCode).toUpperCase() !== connectedCode.value) return

      localStorage.removeItem(`${PLAYER_KEY_PREFIX}${connectedCode.value}`)
      state.value = null
      playerId.value = null
      connectedCode.value = ''
      window.dispatchEvent(new CustomEvent('mahjong:room-disbanded', {
        detail: { roomCode, message }
      }))
    })
    socket.on('connect', rejoinConnectedRoom)
    rejoinConnectedRoom()
  }

  function rejoinConnectedRoom() {
    if (!connectedCode.value) return

    getSocket().emit('room:join', { roomCode: connectedCode.value })
  }

  function clearPlayerId(code: string) {
    localStorage.removeItem(`${PLAYER_KEY_PREFIX}${code.toUpperCase()}`)
    playerId.value = null
  }

  async function createRoom(payload: Parameters<typeof api.createRoom>[0]) {
    loading.value = true
    error.value = ''
    try {
      const result = await api.createRoom(payload)
      state.value = result.state
      storePlayerId(result.state.room.code, result.playerId)
      connectRoom(result.state.room.code)
      return result
    } catch (message) {
      setError(message)
      throw message
    } finally {
      loading.value = false
    }
  }

  async function joinRoom(code: string, nickname: string) {
    loading.value = true
    error.value = ''
    try {
      const result = await api.joinRoom(code.toUpperCase(), nickname)
      state.value = result.state
      storePlayerId(result.state.room.code, result.playerId)
      connectRoom(result.state.room.code)
      return result
    } catch (message) {
      setError(message)
      throw message
    } finally {
      loading.value = false
    }
  }

  async function loadRoom(code: string) {
    loading.value = true
    error.value = ''
    try {
      restorePlayerId(code)
      const result = await api.getRoom(code.toUpperCase())
      state.value = result
      connectRoom(result.room.code)
    } catch (message) {
      setError(message)
    } finally {
      loading.value = false
    }
  }

  async function applyAction(action: () => Promise<RoomState>) {
    loading.value = true
    error.value = ''
    try {
      state.value = await action()
      return true
    } catch (message) {
      setError(message)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    state,
    playerId,
    loading,
    error,
    currentPlayer,
    isOwner,
    createRoom,
    joinRoom,
    loadRoom,
    applyAction,
    clearPlayerId
  }
})
