import { CONFIG } from "./config.js";

async function fetchDisplayName_(env, source, userId) {
  const response = await fetch(
    `https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) return null;
  const profile = await response.json();
  return profile.displayName || null;
}

function getDB_(env) {
  if (!env?.DB) {
    throw new Error("D1 database binding DB is not configured.");
  }
  return env.DB;
}

function normalizeMember_(row) {
  if (!row) return null;

  return {
    userId: String(row.userId),
    displayName: String(row.displayName || "名前未設定"),
    studyMinutes: Math.max(0, Number(row.studyMinutes) || 0),
    dailyGoal: Math.min(
      CONFIG.MAX_GOAL,
      Math.max(0, Number(row.dailyGoal) || CONFIG.DEFAULT_GOAL)
    ),
    carryMinutes: Math.max(0, Number(row.carryMinutes) || 0)
  };
}

export async function members_(env) {
  const result = await getDB_(env).prepare(`
    SELECT userId, displayName, studyMinutes, dailyGoal, carryMinutes
    FROM Members
    WHERE TRIM(userId) <> ''
    ORDER BY rowid
  `).all();

  return (result.results || []).map(normalizeMember_);
}

export async function findMember_(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return null;

  const row = await getDB_(env).prepare(`
    SELECT userId, displayName, dailyGoal
    FROM Members
    WHERE userId = ?
  `).bind(id).first();

  return normalizeMember_(row);
}

export async function ensureMember_(env, userId, source) {
  const id = String(userId || "").trim();
  if (!id) throw new Error("userId is required.");

  const db = getDB_(env);

  await db.prepare(`
    INSERT OR IGNORE INTO Members
      (userId, displayName, studyMinutes, dailyGoal, carryMinutes)
    VALUES (?, '名前未設定', 0, ?, 0)
  `).bind(id, CONFIG.DEFAULT_GOAL).run();

  let member = await findMember_(env, id);

  if (
    member &&
    (!member.displayName ||
      member.displayName === "名前未設定")
  ) {
    const displayName = await fetchDisplayName_(
      env,
      source,
      id
    );

    if (displayName) {
      await db.prepare(`
        UPDATE Members
        SET displayName = ?
        WHERE userId = ?
          AND (
            displayName IS NULL
            OR TRIM(displayName) = ''
            OR displayName = '名前未設定'
          )
      `).bind(displayName, id).run();

      member = await findMember_(env, id);
    }
  }

  return member;
}

export async function refreshMemberProfile_(env, source, userId) {
  const member = await ensureMember_(env, userId, source);

  if (
    member.displayName &&
    member.displayName !== "名前未設定"
  ) {
    return member.displayName;
  }

  const displayName = await fetchDisplayName_(
    env,
    source,
    String(userId).trim()
  );

  if (!displayName) return member.displayName;

  await getDB_(env).prepare(`
    UPDATE Members
    SET displayName = ?
    WHERE userId = ?
      AND (
        displayName IS NULL
        OR TRIM(displayName) = ''
        OR displayName = '名前未設定'
      )
  `).bind(displayName, String(userId).trim()).run();

  const updated = await findMember_(env, userId);
  return updated?.displayName || member.displayName;
}

export async function studyMinutes_(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return 0;

  const row = await getDB_(env).prepare(`
    SELECT studyMinutes
    FROM Members
    WHERE userId = ?
  `).bind(id).first();

  return Math.max(0, Number(row?.studyMinutes) || 0);
}

export async function carryMinutes_(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return 0;

  const row = await getDB_(env).prepare(`
    SELECT carryMinutes
    FROM Members
    WHERE userId = ?
  `).bind(id).first();

  return Math.max(0, Number(row?.carryMinutes) || 0);
}

export async function setCarry_(env, userId, minutes) {
  const id = String(userId || "").trim();
  if (!id) throw new Error("userId is required.");

  const value = Math.max(0, Math.floor(Number(minutes) || 0));

  await ensureMember_(env, id);

  await getDB_(env).prepare(`
    UPDATE Members
    SET carryMinutes = ?
    WHERE userId = ?
  `).bind(value, id).run();
}