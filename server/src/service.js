import { db, now, transaction } from './db.js'

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function rowToRoom(row) {
  if (!row) return null
  return {
    id: row.id,
    code: row.room_code,
    name: row.name || '',
    status: row.status,
    playerCount: row.player_count,
    initialScore: row.initial_score,
    scoreRate: row.score_rate,
    allowNegative: Boolean(row.allow_negative),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }
}

function rowToPlayer(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    nickname: row.nickname,
    seatNo: row.seat_no,
    currentScore: row.current_score,
    joinedAt: row.joined_at,
    isOwner: Boolean(row.is_owner)
  }
}

function generateRoomCode() {
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return code
}

function getRoomRowByCode(code) {
  return db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(code.toUpperCase())
}

function getRoomRowById(id) {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id)
}

function getPlayerRow(id, roomId) {
  return db.prepare('SELECT * FROM players WHERE id = ? AND room_id = ?').get(id, roomId)
}

function ensureRoom(code) {
  const room = getRoomRowByCode(code)
  if (!room) {
    const error = new Error('房间不存在')
    error.statusCode = 404
    throw error
  }
  return room
}

function ensureOwner(roomId, playerId) {
  const player = getPlayerRow(Number(playerId), roomId)
  if (!player || !player.is_owner) {
    const error = new Error('只有房主可以执行该操作')
    error.statusCode = 403
    throw error
  }
  return player
}

function assertPositiveInteger(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    const error = new Error(`${label} 必须是正整数`)
    error.statusCode = 400
    throw error
  }
  return number
}

function assertNonNegativeInteger(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) {
    const error = new Error(`${label} 必须是 0 或正整数`)
    error.statusCode = 400
    throw error
  }
  return number
}

function assertNickname(nickname) {
  const value = String(nickname || '').trim()
  if (!value || value.length > 16) {
    const error = new Error('昵称不能为空，且最多 16 个字符')
    error.statusCode = 400
    throw error
  }
  return value
}

function readTransactions(roomId) {
  return db.prepare(`
    SELECT
      t.*,
      fp.nickname AS from_nickname,
      tp.nickname AS to_nickname,
      cp.nickname AS created_by_nickname,
      up.nickname AS undo_requested_by_nickname
    FROM transactions t
    JOIN players fp ON fp.id = t.from_player_id
    JOIN players tp ON tp.id = t.to_player_id
    LEFT JOIN players cp ON cp.id = t.created_by
    LEFT JOIN players up ON up.id = t.undo_requested_by
    WHERE t.room_id = ?
    ORDER BY t.id DESC
  `).all(roomId).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    fromPlayerId: row.from_player_id,
    fromNickname: row.from_nickname,
    toPlayerId: row.to_player_id,
    toNickname: row.to_nickname,
    amount: row.amount,
    remark: row.remark || '',
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByNickname: row.created_by_nickname || '',
    isReverted: Boolean(row.is_reverted),
    revertedAt: row.reverted_at,
    undoRequestedAt: row.undo_requested_at,
    undoRequestedBy: row.undo_requested_by,
    undoRequestedByNickname: row.undo_requested_by_nickname || '',
    undoFromConfirmedAt: row.undo_from_confirmed_at,
    undoToConfirmedAt: row.undo_to_confirmed_at
  }))
}

function readSettlements(roomId) {
  return db.prepare(`
    SELECT s.*, p.nickname
    FROM settlements s
    JOIN players p ON p.id = s.player_id
    WHERE s.room_id = ?
    ORDER BY p.seat_no ASC
  `).all(roomId).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    playerId: row.player_id,
    nickname: row.nickname,
    initialScore: row.initial_score,
    finalScore: row.final_score,
    diffScore: row.diff_score,
    moneyAmount: row.money_amount,
    createdAt: row.created_at
  }))
}

export function getRoomState(codeOrRoomId) {
  const roomRow = typeof codeOrRoomId === 'number'
    ? getRoomRowById(codeOrRoomId)
    : getRoomRowByCode(codeOrRoomId)

  if (!roomRow) return null

  const players = db.prepare(`
    SELECT * FROM players WHERE room_id = ? ORDER BY seat_no ASC
  `).all(roomRow.id).map(rowToPlayer)

  return {
    room: rowToRoom(roomRow),
    players,
    transactions: readTransactions(roomRow.id),
    settlements: readSettlements(roomRow.id)
  }
}

export function createRoom(payload) {
  return transaction(() => {
    const playerCount = Number(payload.playerCount)
    if (![3, 4].includes(playerCount)) {
      const error = new Error('房间模式只支持三人或四人')
      error.statusCode = 400
      throw error
    }

    const initialScore = assertNonNegativeInteger(payload.initialScore ?? 1000, '起始分')
    const scoreRate = Number(payload.scoreRate ?? 1)
    if (!Number.isFinite(scoreRate) || scoreRate <= 0) {
      const error = new Error('计分单位必须大于 0')
      error.statusCode = 400
      throw error
    }

    const ownerNickname = assertNickname(payload.ownerNickname)
    const createdAt = now()
    let code = generateRoomCode()

    while (getRoomRowByCode(code)) {
      code = generateRoomCode()
    }

    const roomResult = db.prepare(`
      INSERT INTO rooms (
        room_code, name, status, player_count, initial_score, score_rate,
        allow_negative, created_at
      )
      VALUES (?, ?, 'waiting', ?, ?, ?, ?, ?)
    `).run(
      code,
      String(payload.name || '').trim(),
      playerCount,
      initialScore,
      scoreRate,
      payload.allowNegative === false ? 0 : 1,
      createdAt
    )

    const playerResult = db.prepare(`
      INSERT INTO players (room_id, nickname, seat_no, current_score, joined_at, is_owner)
      VALUES (?, ?, 1, ?, ?, 1)
    `).run(roomResult.lastInsertRowid, ownerNickname, initialScore, createdAt)

    return {
      state: getRoomState(Number(roomResult.lastInsertRowid)),
      playerId: Number(playerResult.lastInsertRowid)
    }
  })
}

export function joinRoom(code, payload) {
  return transaction(() => {
    const room = ensureRoom(code)
    if (room.status !== 'waiting') {
      const error = new Error('对局已开始或已结束，无法加入')
      error.statusCode = 409
      throw error
    }

    const currentPlayers = db.prepare('SELECT COUNT(*) AS count FROM players WHERE room_id = ?').get(room.id).count
    if (currentPlayers >= room.player_count) {
      const error = new Error('房间人数已满')
      error.statusCode = 409
      throw error
    }

    const nickname = assertNickname(payload.nickname)
    const duplicated = db.prepare(`
      SELECT id FROM players WHERE room_id = ? AND nickname = ?
    `).get(room.id, nickname)
    if (duplicated) {
      const error = new Error('该昵称已在房间中使用')
      error.statusCode = 409
      throw error
    }

    const result = db.prepare(`
      INSERT INTO players (room_id, nickname, seat_no, current_score, joined_at, is_owner)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(room.id, nickname, currentPlayers + 1, room.initial_score, now())

    return {
      state: getRoomState(room.id),
      playerId: Number(result.lastInsertRowid)
    }
  })
}

export function startGame(code, playerId) {
  return transaction(() => {
    const room = ensureRoom(code)
    ensureOwner(room.id, playerId)

    if (room.status !== 'waiting') {
      const error = new Error('只有等待中的房间可以开始')
      error.statusCode = 409
      throw error
    }

    const playerTotal = db.prepare('SELECT COUNT(*) AS count FROM players WHERE room_id = ?').get(room.id).count
    if (playerTotal < 2) {
      const error = new Error('至少需要 2 名玩家才能开始')
      error.statusCode = 400
      throw error
    }

    db.prepare(`
      UPDATE rooms SET status = 'playing', started_at = ? WHERE id = ?
    `).run(now(), room.id)

    return getRoomState(room.id)
  })
}

export function transferScore(code, payload) {
  return transaction(() => {
    const room = ensureRoom(code)
    if (room.status !== 'playing') {
      const error = new Error('只有进行中的房间可以记分')
      error.statusCode = 409
      throw error
    }

    const fromPlayerId = Number(payload.fromPlayerId)
    const toPlayerId = Number(payload.toPlayerId)
    if (fromPlayerId === toPlayerId) {
      const error = new Error('付款方和收款方不能相同')
      error.statusCode = 400
      throw error
    }

    const amount = assertPositiveInteger(payload.amount, '分数')
    const fromPlayer = getPlayerRow(fromPlayerId, room.id)
    const toPlayer = getPlayerRow(toPlayerId, room.id)
    const createdBy = payload.createdBy ? Number(payload.createdBy) : null

    if (!fromPlayer || !toPlayer || (createdBy && !getPlayerRow(createdBy, room.id))) {
      const error = new Error('玩家不存在或不属于该房间')
      error.statusCode = 400
      throw error
    }

    if (!room.allow_negative && fromPlayer.current_score - amount < 0) {
      const error = new Error('该房间不允许负分')
      error.statusCode = 409
      throw error
    }

    db.prepare('UPDATE players SET current_score = current_score - ? WHERE id = ?').run(amount, fromPlayerId)
    db.prepare('UPDATE players SET current_score = current_score + ? WHERE id = ?').run(amount, toPlayerId)
    db.prepare(`
      INSERT INTO transactions (
        room_id, from_player_id, to_player_id, amount, remark, created_at, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(room.id, fromPlayerId, toPlayerId, amount, String(payload.remark || '').trim(), now(), createdBy)

    return getRoomState(room.id)
  })
}

export function confirmTransactionUndo(code, transactionId, playerId) {
  return transaction(() => {
    const room = ensureRoom(code)
    if (room.status !== 'playing') {
      const error = new Error('只有进行中的房间可以撤销')
      error.statusCode = 409
      throw error
    }

    const actorId = Number(playerId)
    const item = db.prepare(`
      SELECT * FROM transactions
      WHERE id = ? AND room_id = ? AND is_reverted = 0
    `).get(Number(transactionId), room.id)

    if (!item) {
      const error = new Error('流水不存在或已撤销')
      error.statusCode = 404
      throw error
    }

    const isFromPlayer = item.from_player_id === actorId
    const isToPlayer = item.to_player_id === actorId
    if (!isFromPlayer && !isToPlayer) {
      const error = new Error('只有该笔流水的收付双方可以确认撤销')
      error.statusCode = 403
      throw error
    }

    if (!getPlayerRow(actorId, room.id)) {
      const error = new Error('玩家不存在或不属于该房间')
      error.statusCode = 400
      throw error
    }

    const currentTime = now()
    const requestedAt = item.undo_requested_at || currentTime
    const requestedBy = item.undo_requested_by || actorId
    const fromConfirmedAt = item.undo_from_confirmed_at || (isFromPlayer ? currentTime : null)
    const toConfirmedAt = item.undo_to_confirmed_at || (isToPlayer ? currentTime : null)

    db.prepare(`
      UPDATE transactions
      SET
        undo_requested_at = ?,
        undo_requested_by = ?,
        undo_from_confirmed_at = ?,
        undo_to_confirmed_at = ?
      WHERE id = ?
    `).run(requestedAt, requestedBy, fromConfirmedAt, toConfirmedAt, item.id)

    if (fromConfirmedAt && toConfirmedAt) {
      db.prepare('UPDATE players SET current_score = current_score + ? WHERE id = ?').run(item.amount, item.from_player_id)
      db.prepare('UPDATE players SET current_score = current_score - ? WHERE id = ?').run(item.amount, item.to_player_id)
      db.prepare('UPDATE transactions SET is_reverted = 1, reverted_at = ? WHERE id = ?').run(currentTime, item.id)
    }

    return getRoomState(room.id)
  })
}

export function finishGame(code, playerId) {
  return transaction(() => {
    const room = ensureRoom(code)
    ensureOwner(room.id, playerId)

    if (room.status !== 'playing') {
      const error = new Error('只有进行中的房间可以结束')
      error.statusCode = 409
      throw error
    }

    const finishedAt = now()
    db.prepare('DELETE FROM settlements WHERE room_id = ?').run(room.id)

    const players = db.prepare('SELECT * FROM players WHERE room_id = ? ORDER BY seat_no ASC').all(room.id)
    for (const player of players) {
      const diff = player.current_score - room.initial_score
      db.prepare(`
        INSERT INTO settlements (
          room_id, player_id, initial_score, final_score, diff_score, money_amount, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(room.id, player.id, room.initial_score, player.current_score, diff, diff / room.score_rate, finishedAt)
    }

    db.prepare(`
      UPDATE rooms SET status = 'finished', finished_at = ? WHERE id = ?
    `).run(finishedAt, room.id)

    return getRoomState(room.id)
  })
}

export function listHistory() {
  return db.prepare(`
    SELECT
      r.*,
      GROUP_CONCAT(p.nickname, '、') AS player_names
    FROM rooms r
    LEFT JOIN players p ON p.room_id = r.id
    WHERE r.status = 'finished'
    GROUP BY r.id
    ORDER BY r.finished_at DESC
  `).all().map((row) => ({
    ...rowToRoom(row),
    playerNames: row.player_names || ''
  }))
}

export function getHistoryDetail(roomId) {
  return getRoomState(Number(roomId))
}
