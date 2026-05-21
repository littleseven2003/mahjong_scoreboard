import { createHmac, timingSafeEqual } from 'node:crypto'
import { db, now, transaction } from './db.js'
import { getRoomState } from './service.js'

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000
const DEFAULT_MAINTENANCE = {
  cleanupEnabled: false,
  cleanupFinishedDays: 30,
  cleanupIntervalHours: 24
}

function createError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || '')
}

function getTokenSecret() {
  return String(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'mahjong-scoreboard-admin')
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url')
}

function signPayload(payload) {
  return createHmac('sha256', getTokenSecret()).update(payload).digest('base64url')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function parsePositiveInteger(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

function readSetting(key) {
  return db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key)?.value
}

function writeSetting(key, value) {
  db.prepare(`
    INSERT INTO admin_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value), now())
}

export function getMaintenanceSettings() {
  return {
    cleanupEnabled: readSetting('cleanup_enabled') === 'true',
    cleanupFinishedDays: parsePositiveInteger(readSetting('cleanup_finished_days'), DEFAULT_MAINTENANCE.cleanupFinishedDays),
    cleanupIntervalHours: parsePositiveInteger(readSetting('cleanup_interval_hours'), DEFAULT_MAINTENANCE.cleanupIntervalHours)
  }
}

export function updateMaintenanceSettings(payload = {}) {
  const cleanupEnabled = Boolean(payload.cleanupEnabled)
  const cleanupFinishedDays = parsePositiveInteger(payload.cleanupFinishedDays, DEFAULT_MAINTENANCE.cleanupFinishedDays)
  const cleanupIntervalHours = parsePositiveInteger(payload.cleanupIntervalHours, DEFAULT_MAINTENANCE.cleanupIntervalHours)

  if (cleanupFinishedDays < 1 || cleanupFinishedDays > 3650) {
    throw createError('已结束对局保留天数应在 1 到 3650 之间')
  }
  if (cleanupIntervalHours < 1 || cleanupIntervalHours > 720) {
    throw createError('清理间隔应在 1 到 720 小时之间')
  }

  transaction(() => {
    writeSetting('cleanup_enabled', cleanupEnabled ? 'true' : 'false')
    writeSetting('cleanup_finished_days', cleanupFinishedDays)
    writeSetting('cleanup_interval_hours', cleanupIntervalHours)
  })

  return getMaintenanceSettings()
}

export function createAdminToken(password) {
  const expectedPassword = getAdminPassword()
  if (!expectedPassword) {
    throw createError('管理员密码未配置，请设置 ADMIN_PASSWORD 环境变量', 503)
  }
  if (!safeEqual(password || '', expectedPassword)) {
    throw createError('管理员密码不正确', 401)
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  const payload = base64Url(JSON.stringify({ scope: 'admin', exp: expiresAt }))
  const signature = signPayload(payload)
  return {
    token: `${payload}.${signature}`,
    expiresAt
  }
}

export function verifyAdminToken(token) {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    throw createError('管理员登录已失效，请重新验证', 401)
  }

  let data
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw createError('管理员登录已失效，请重新验证', 401)
  }

  if (data.scope !== 'admin' || !data.exp || Date.now() > new Date(data.exp).getTime()) {
    throw createError('管理员登录已失效，请重新验证', 401)
  }
  return data
}

export function getAdminSummary() {
  const roomCounts = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM rooms
    GROUP BY status
  `).all()
  const totals = {
    rooms: 0,
    waitingRooms: 0,
    playingRooms: 0,
    finishedRooms: 0,
    players: db.prepare('SELECT COUNT(*) AS count FROM players').get().count,
    transactions: db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count,
    settlements: db.prepare('SELECT COUNT(*) AS count FROM settlements').get().count
  }

  for (const item of roomCounts) {
    totals.rooms += item.count
    if (item.status === 'waiting') totals.waitingRooms = item.count
    if (item.status === 'playing') totals.playingRooms = item.count
    if (item.status === 'finished') totals.finishedRooms = item.count
  }

  return {
    ...totals,
    maintenance: getMaintenanceSettings()
  }
}

export function listAdminRooms() {
  return db.prepare(`
    SELECT
      r.*,
      COUNT(DISTINCT p.id) AS player_count_current,
      COUNT(DISTINCT t.id) AS transaction_count,
      COALESCE(r.finished_at, r.started_at, r.created_at) AS last_active_at,
      GROUP_CONCAT(DISTINCT p.nickname) AS player_names
    FROM rooms r
    LEFT JOIN players p ON p.room_id = r.id
    LEFT JOIN transactions t ON t.room_id = r.id
    GROUP BY r.id
    ORDER BY datetime(last_active_at) DESC
  `).all().map((row) => ({
    id: row.id,
    code: row.room_code,
    name: row.name,
    status: row.status,
    configuredPlayerCount: row.player_count,
    playerCount: row.player_count_current,
    transactionCount: row.transaction_count,
    playerNames: row.player_names || '',
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    lastActiveAt: row.last_active_at
  }))
}

export function getAdminRoomDetail(roomId) {
  const detail = getRoomState(Number(roomId))
  if (!detail) {
    throw createError('对局不存在', 404)
  }
  return detail
}

export function deleteAdminRoom(roomId) {
  return transaction(() => {
    const room = db.prepare('SELECT id, room_code FROM rooms WHERE id = ?').get(Number(roomId))
    if (!room) {
      throw createError('对局不存在', 404)
    }
    db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id)
    return {
      ok: true,
      roomId: room.id,
      roomCode: room.room_code
    }
  })
}

export function cleanupFinishedRooms() {
  const settings = getMaintenanceSettings()
  const cutoff = new Date(Date.now() - settings.cleanupFinishedDays * 24 * 60 * 60 * 1000).toISOString()

  return transaction(() => {
    const rooms = db.prepare(`
      SELECT id, room_code
      FROM rooms
      WHERE status = 'finished' AND finished_at IS NOT NULL AND datetime(finished_at) < datetime(?)
    `).all(cutoff)

    for (const room of rooms) {
      db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id)
    }

    return {
      deletedCount: rooms.length,
      deletedRoomCodes: rooms.map((room) => room.room_code),
      cutoff
    }
  })
}
