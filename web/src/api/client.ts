import { io, type Socket } from 'socket.io-client'

export interface Room {
  id: number
  code: string
  name: string
  status: 'waiting' | 'playing' | 'finished'
  playerCount: number
  initialScore: number
  scoreRate: number
  allowNegative: boolean
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  playerNames?: string
}

export interface Player {
  id: number
  roomId: number
  nickname: string
  seatNo: number
  currentScore: number
  joinedAt: string
  isOwner: boolean
  isReady: boolean
}

export interface ScoreTransaction {
  id: number
  roomId: number
  fromPlayerId: number
  fromNickname: string
  toPlayerId: number
  toNickname: string
  amount: number
  remark: string
  createdAt: string
  createdBy: number | null
  createdByNickname: string
  isReverted: boolean
  revertedAt: string | null
  undoRequestedAt: string | null
  undoRequestedBy: number | null
  undoRequestedByNickname: string
  undoFromConfirmedAt: string | null
  undoToConfirmedAt: string | null
}

export interface Settlement {
  id: number
  roomId: number
  playerId: number
  nickname: string
  initialScore: number
  finalScore: number
  diffScore: number
  moneyAmount: number
  createdAt: string
}

export interface RoomState {
  room: Room
  players: Player[]
  transactions: ScoreTransaction[]
  settlements: Settlement[]
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || '请求失败')
  }
  return data as T
}

export const api = {
  createRoom(payload: {
    playerCount: number
    name: string
    initialScore: number
    scoreRate: number
    allowNegative: boolean
    ownerNickname: string
  }) {
    return request<{ state: RoomState; playerId: number }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  joinRoom(code: string, nickname: string) {
    return request<{ state: RoomState; playerId: number }>(`/api/rooms/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname })
    })
  },
  getRoom(code: string) {
    return request<RoomState>(`/api/rooms/${code}`)
  },
  startGame(code: string, playerId: number) {
    return request<RoomState>(`/api/rooms/${code}/start`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    })
  },
  setReady(code: string, playerId: number, isReady: boolean) {
    return request<RoomState>(`/api/rooms/${code}/ready`, {
      method: 'POST',
      body: JSON.stringify({ playerId, isReady })
    })
  },
  leaveRoom(code: string, playerId: number) {
    return request<RoomState>(`/api/rooms/${code}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    })
  },
  disbandRoom(code: string, playerId: number) {
    return request<{ ok: true }>(`/api/rooms/${code}/disband`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    })
  },
  transferScore(code: string, payload: {
    fromPlayerId: number
    toPlayerId: number
    amount: number
    remark: string
    createdBy: number | null
  }) {
    return request<RoomState>(`/api/rooms/${code}/transfer`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  confirmUndo(code: string, transactionId: number, playerId: number) {
    return request<RoomState>(`/api/rooms/${code}/transactions/${transactionId}/undo-confirm`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    })
  },
  cancelUndo(code: string, transactionId: number, playerId: number) {
    return request<RoomState>(`/api/rooms/${code}/transactions/${transactionId}/undo-cancel`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    })
  },
  finish(code: string, playerId: number) {
    return request<RoomState>(`/api/rooms/${code}/finish`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    })
  },
  history() {
    return request<Room[]>('/api/history')
  },
  historyDetail(id: string) {
    return request<RoomState>(`/api/history/${id}`)
  }
}

let socket: Socket | null = null

export function getSocket() {
  socket ??= io('/', {
    path: '/socket.io'
  })
  return socket
}
