import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server } from 'socket.io'
import {
  cleanupFinishedRooms,
  createAdminToken,
  deleteAdminRoom,
  getAdminRoomDetail,
  getAdminSummary,
  getMaintenanceSettings,
  listAdminRooms,
  updateMaintenanceSettings,
  verifyAdminToken
} from './admin.js'
import {
  cancelTransactionUndo,
  confirmTransactionUndo,
  createRoom,
  disbandWaitingRoom,
  finishGame,
  getHistoryDetail,
  getRoomState,
  joinRoom,
  listHistory,
  leaveWaitingRoom,
  setPlayerReady,
  startGame,
  transferScore
} from './service.js'

const port = Number(process.env.PORT || 3100)
const app = Fastify({ logger: true })
let cleanupTimer = null

await app.register(cors, {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
})

const io = new Server(app.server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
})

function roomChannel(code) {
  return `room:${String(code).toUpperCase()}`
}

function broadcastRoom(state) {
  if (state?.room?.code) {
    io.to(roomChannel(state.room.code)).emit('room:sync', state)
  }
}

function sendError(reply, error) {
  const statusCode = error.statusCode || 500
  reply.code(statusCode).send({
    error: error.message || '服务器错误'
  })
}

function requireAdmin(request) {
  const auth = request.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return verifyAdminToken(token)
}

function scheduleCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }

  const settings = getMaintenanceSettings()
  if (!settings.cleanupEnabled) return

  const intervalMs = settings.cleanupIntervalHours * 60 * 60 * 1000
  cleanupTimer = setInterval(() => {
    try {
      const result = cleanupFinishedRooms()
      app.log.info({ result }, 'admin cleanup finished')
    } catch (error) {
      app.log.error({ error }, 'admin cleanup failed')
    }
  }, intervalMs)
}

app.get('/api/health', async () => ({
  ok: true,
  service: 'mahjong_scoreboard',
  time: new Date().toISOString()
}))

app.post('/api/admin/login', async (request, reply) => {
  try {
    reply.send(createAdminToken(request.body?.password))
  } catch (error) {
    sendError(reply, error)
  }
})

app.get('/api/admin/summary', async (request, reply) => {
  try {
    requireAdmin(request)
    reply.send(getAdminSummary())
  } catch (error) {
    sendError(reply, error)
  }
})

app.get('/api/admin/rooms', async (request, reply) => {
  try {
    requireAdmin(request)
    reply.send(listAdminRooms())
  } catch (error) {
    sendError(reply, error)
  }
})

app.get('/api/admin/rooms/:id', async (request, reply) => {
  try {
    requireAdmin(request)
    reply.send(getAdminRoomDetail(request.params.id))
  } catch (error) {
    sendError(reply, error)
  }
})

app.delete('/api/admin/rooms/:id', async (request, reply) => {
  try {
    requireAdmin(request)
    reply.send(deleteAdminRoom(request.params.id))
  } catch (error) {
    sendError(reply, error)
  }
})

app.get('/api/admin/maintenance', async (request, reply) => {
  try {
    requireAdmin(request)
    reply.send(getMaintenanceSettings())
  } catch (error) {
    sendError(reply, error)
  }
})

app.put('/api/admin/maintenance', async (request, reply) => {
  try {
    requireAdmin(request)
    const settings = updateMaintenanceSettings(request.body || {})
    scheduleCleanup()
    reply.send(settings)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/admin/maintenance/cleanup', async (request, reply) => {
  try {
    requireAdmin(request)
    reply.send(cleanupFinishedRooms())
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms', async (request, reply) => {
  try {
    const result = createRoom(request.body || {})
    broadcastRoom(result.state)
    reply.code(201).send(result)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/join', async (request, reply) => {
  try {
    const result = joinRoom(request.params.code, request.body || {})
    broadcastRoom(result.state)
    reply.send(result)
  } catch (error) {
    sendError(reply, error)
  }
})

app.get('/api/rooms/:code', async (request, reply) => {
  const state = getRoomState(request.params.code)
  if (!state) {
    reply.code(404).send({ error: '房间不存在' })
    return
  }
  reply.send(state)
})

app.post('/api/rooms/:code/start', async (request, reply) => {
  try {
    const state = startGame(request.params.code, request.body?.playerId)
    broadcastRoom(state)
    reply.send(state)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/ready', async (request, reply) => {
  try {
    const state = setPlayerReady(request.params.code, request.body?.playerId, request.body?.isReady)
    broadcastRoom(state)
    reply.send(state)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/leave', async (request, reply) => {
  try {
    const state = leaveWaitingRoom(request.params.code, request.body?.playerId)
    broadcastRoom(state)
    reply.send(state)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/disband', async (request, reply) => {
  try {
    const result = disbandWaitingRoom(request.params.code, request.body?.playerId)
    io.to(roomChannel(result.roomCode)).emit('room:disbanded', {
      roomCode: result.roomCode,
      message: '房间已解散'
    })
    reply.send({ ok: true })
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/transfer', async (request, reply) => {
  try {
    const state = transferScore(request.params.code, request.body || {})
    broadcastRoom(state)
    reply.send(state)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/transactions/:transactionId/undo-confirm', async (request, reply) => {
  try {
    const state = confirmTransactionUndo(
      request.params.code,
      request.params.transactionId,
      request.body?.playerId
    )
    broadcastRoom(state)
    reply.send(state)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/transactions/:transactionId/undo-cancel', async (request, reply) => {
  try {
    const state = cancelTransactionUndo(
      request.params.code,
      request.params.transactionId,
      request.body?.playerId
    )
    broadcastRoom(state)
    reply.send(state)
  } catch (error) {
    sendError(reply, error)
  }
})

app.post('/api/rooms/:code/finish', async (request, reply) => {
  try {
    const state = finishGame(request.params.code, request.body?.playerId)
    broadcastRoom(state)
    reply.send(state)
  } catch (error) {
    sendError(reply, error)
  }
})

app.get('/api/history', async () => listHistory())

app.get('/api/history/:id', async (request, reply) => {
  const detail = getHistoryDetail(request.params.id)
  if (!detail) {
    reply.code(404).send({ error: '历史对局不存在' })
    return
  }
  reply.send(detail)
})

io.on('connection', (socket) => {
  socket.on('room:join', async ({ roomCode }) => {
    const code = String(roomCode || '').toUpperCase()
    if (!code) return

    socket.join(roomChannel(code))
    const state = getRoomState(code)
    if (state) {
      socket.emit('room:sync', state)
    }
  })

  socket.on('room:leave', ({ roomCode }) => {
    const code = String(roomCode || '').toUpperCase()
    if (code) {
      socket.leave(roomChannel(code))
    }
  })
})

scheduleCleanup()
await app.listen({ host: '0.0.0.0', port })
