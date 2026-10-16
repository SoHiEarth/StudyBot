import { CONFIG } from "./config.js";
import {
  ensureMember_,
  refreshMemberProfile_
} from "./member.js";
import { formatMinutes_ } from "./date.js";

export function rouletteChatKey_(source, userId) {
  if (source?.type === "group" && source.groupId) {
    return `group:${source.groupId}`;
  }

  if (source?.type === "room" && source.roomId) {
    return `room:${source.roomId}`;
  }

  return `user:${userId}`;
}

export async function joinRoulette_(env, source, userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return "ユーザーを確認できませんでした。";
  }

  const chatKey = rouletteChatKey_(source, id);
  const db = env.DB;

  const member = await ensureMember_(env, id, source);
  const displayName =
    member?.displayName ||
    "名前未設定";

  const result = await db.prepare(`
    INSERT OR IGNORE INTO RouletteParticipants
      (chatKey, userId, displayName, joinedAt)
    VALUES (?, ?, ?, ?)
  `).bind(
    chatKey,
    id,
    displayName,
    new Date().toISOString()
  ).run();

  if (result.meta.changes === 0) {
    return "すでにルーレットに参加しています！";
  }

  return `** ${displayName} **がルーレットに参加！`;
}

export async function rouletteMaxPenalty_(env, userId, now) {
  const id = String(userId || "").trim();

  const member = await env.DB.prepare(`
    SELECT studyMinutes, dailyGoal, carryMinutes
    FROM Members
    WHERE userId = ?
    LIMIT 1
  `).bind(id).first();

  return rouletteMaxPenaltyForMember_(member, now);
}

export function rouletteMaxPenaltyForMember_(member, now) {
  if (!member) return 0;

  const actual = Math.max(
    0,
    Number(member.studyMinutes) || 0
  );

  const goal = Math.min(
    CONFIG.MAX_GOAL,
    Math.max(
      1,
      Number(member.dailyGoal) || CONFIG.DEFAULT_GOAL
    )
  );

  const carry = Math.max(
    0,
    Number(member.carryMinutes) || 0
  );

  const target = Math.min(
    CONFIG.DAILY_CAP,
    goal + carry
  );

  // Get the current hour and minute in the configured timezone.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFIG.TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  const minutesNow =
    Number(values.hour) * 60 +
    Number(values.minute);

  const remainingDay = 1440 - minutesNow;
  const remainingTarget = Math.max(0, target - actual);

  const timeAvailable = Math.max(
    0,
    remainingDay - remainingTarget
  );

  const capacityAvailable = Math.max(
    0,
    CONFIG.DAILY_CAP - target
  );

  return Math.max(
    0,
    Math.min(
      CONFIG.ROULETTE_MAX_PENALTY,
      timeAvailable,
      capacityAvailable
    )
  );
}

export async function startRoulette_(env, source) {
  const db = env.DB;

  const chatKey = rouletteChatKey_(
    source,
    source?.userId || ""
  );

  const result = await db.prepare(`
    SELECT p.userId, p.displayName,
           m.studyMinutes, m.dailyGoal, m.carryMinutes
    FROM RouletteParticipants p
    LEFT JOIN Members m ON m.userId = p.userId
    WHERE p.chatKey = ?
    ORDER BY p.joinedAt ASC
  `).bind(chatKey).all();

  const participants = (result.results || []).map(row => ({
    userId: String(row.userId),
    name: String(row.displayName || "名前未設定"),
    member: row
  }));

  if (participants.length < 2) {
    return "参加者が2人以上必要です。\n" +
      "参加する人は /ルーレット参加 を送信してください。";
  }

  const now = new Date();

  const eligible = [];

  for (const participant of participants) {
    const maxPenalty = rouletteMaxPenaltyForMember_(participant.member, now);

    if (maxPenalty >= CONFIG.ROULETTE_MIN_PENALTY) {
      eligible.push({
        ...participant,
        maxPenalty: Math.floor(maxPenalty)
      });
    }
  }

  if (eligible.length < 2) {
    return "現在、達成可能なペナルティーを課せる参加者が" +
      "2人未満のため、ルーレットを開始できません。\n" +
      "勉強時間を記録するか、時間をおいて再挑戦してください。";
  }

  const loser = eligible[
    Math.floor(Math.random() * eligible.length)
  ];

  const penalty =
    CONFIG.ROULETTE_MIN_PENALTY +
    Math.floor(
      Math.random() *
      (
        loser.maxPenalty -
        CONFIG.ROULETTE_MIN_PENALTY + 1
      )
    );

  // Increment carryover directly in D1.
  const update = await db.prepare(`
    UPDATE Members
    SET carryMinutes = COALESCE(carryMinutes, 0) + ?
    WHERE userId = ?
  `).bind(penalty, loser.userId).run();

  if (update.meta.changes !== 1) {
    throw new Error(
      "Failed to apply roulette penalty to " + loser.userId
    );
  }

  // Clear this chat's participants after applying the penalty.
  await db.prepare(`
    DELETE FROM RouletteParticipants
    WHERE chatKey = ?
  `).bind(chatKey).run();

  return "## ルーレットの結果\n" +
    `**💀 ${loser.name} が当たりました！**\n` +
    `ペナルティー：**${formatMinutes_(penalty)}**\n` +
    "今日の目標にペナルティーを加算しました。\n" +
    "今日中に達成できなかった分は、既存の精算機能により翌日へ繰り越されます。";
}

export async function ListRouletteParticipants(env, source) {
  const chatKey = rouletteChatKey_(
    source,
    source?.userId || ""
  );

  const result = await env.DB.prepare(`
    SELECT userId, displayName
    FROM RouletteParticipants
    WHERE chatKey = ?
    ORDER BY joinedAt ASC
  `).bind(chatKey).all();

  const participants = result.results || [];

  if (participants.length === 0) {
    return "現在のルーレットの参加者はいません。\n" +
      "参加する人は /ルーレット参加 を送信してください。";
  }

  const participantList = participants
    .map((p, i) =>
      `${i + 1}. ${p.displayName || "名前未設定"}`
    )
    .join("\n");

  return "## 🎯 ルーレット参加者\n" +
    `参加人数：**${participants.length}人**\n\n` +
    participantList;
}

export async function ForceJoinAll(env, source, userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return "ユーザーを確認できませんでした。";
  }

  const db = env.DB;
  const chatKey = rouletteChatKey_(source, id);

  const memberResult = await db.prepare(`
    SELECT userId, displayName
    FROM Members
    WHERE TRIM(COALESCE(userId, '')) <> ''
  `).all();

  const members = memberResult.results || [];

  if (members.length === 0) {
    return "登録済みのメンバーがいません。";
  }

  const existingResult = await db.prepare(`
    SELECT userId
    FROM RouletteParticipants
    WHERE chatKey = ?
  `).bind(chatKey).all();

  const existingIds = new Set(
    (existingResult.results || []).map(
      row => String(row.userId)
    )
  );

  let additions = 0;
  const now = new Date().toISOString();

  for (const member of members) {
    const memberId = String(member.userId).trim();

    if (!memberId || existingIds.has(memberId)) {
      continue;
    }

    const name =
      await refreshMemberProfile_(env, source, memberId) ||
      member.displayName ||
      "名前未設定";

    const result = await db.prepare(`
      INSERT OR IGNORE INTO RouletteParticipants
        (chatKey, userId, displayName, joinedAt)
      VALUES (?, ?, ?, ?)
    `).bind(
      chatKey,
      memberId,
      name,
      now
    ).run();

    if (result.meta.changes > 0) {
      additions++;
      existingIds.add(memberId);
    }
  }

  const extraPenalty = Math.min(
    CONFIG.DAILY_CAP,
    Math.max(
      CONFIG.ROULETTE_MIN_PENALTY,
      CONFIG.ROULETTE_MAX_PENALTY
    )
  );

  const penaltyUpdate = await db.prepare(`
    UPDATE Members
    SET carryMinutes = COALESCE(carryMinutes, 0) + ?
    WHERE userId = ?
  `).bind(extraPenalty, id).run();

  if (penaltyUpdate.meta.changes !== 1) {
    throw new Error(
      "Failed to apply ForceJoinAll penalty to " + id
    );
  }

  return "## 💥 全員をルーレットに招集！\n" +
    `新規参加者：**${additions}人**\n` +
    `現在の参加人数：**${existingIds.size}人**\n\n` +
    `実行者への追加ペナルティー：**${formatMinutes_(extraPenalty)}**\n` +
    "全員がルーレットに参加しました。";
}