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

export interface AdminSummary {
  rooms: number
  waitingRooms: number
  playingRooms: number
  finishedRooms: number
  players: number
  transactions: number
  settlements: number
  maintenance: AdminMaintenanceSettings
}

export interface AdminRoom {
  id: number
  code: string
  name: string
  status: Room['status']
  configuredPlayerCount: number
  playerCount: number
  transactionCount: number
  playerNames: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  lastActiveAt: string
}

export interface AdminMaintenanceSettings {
  cleanupEnabled: boolean
  cleanupFinishedDays: number
  cleanupIntervalHours: number
}

export interface AdminCleanupResult {
  deletedCount: number
  deletedRoomCodes: string[]
  cutoff: string
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
  },
  adminLogin(password: string) {
    return request<{ token: string; expiresAt: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    })
  },
  adminSummary(token: string) {
    return request<AdminSummary>('/api/admin/summary', {
      headers: { Authorization: `Bearer ${token}` }
    })
  },
  adminRooms(token: string) {
    return request<AdminRoom[]>('/api/admin/rooms', {
      headers: { Authorization: `Bearer ${token}` }
    })
  },
  adminRoomDetail(token: string, id: number) {
    return request<RoomState>(`/api/admin/rooms/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  },
  deleteAdminRoom(token: string, id: number) {
    return request<{ ok: true; roomId: number; roomCode: string }>(`/api/admin/rooms/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
  },
  adminMaintenance(token: string) {
    return request<AdminMaintenanceSettings>('/api/admin/maintenance', {
      headers: { Authorization: `Bearer ${token}` }
    })
  },
  updateAdminMaintenance(token: string, payload: AdminMaintenanceSettings) {
    return request<AdminMaintenanceSettings>('/api/admin/maintenance', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
  },
  runAdminCleanup(token: string) {
    return request<AdminCleanupResult>('/api/admin/maintenance/cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
  }
}

let socket: Socket | null = null

export function getSocket() {
  socket ??= io('/', {
    path: '/socket.io'
  })
  return socket
}
