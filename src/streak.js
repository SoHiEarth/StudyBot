import { shiftDate_, today_ } from "./date.js";

export async function recordStudyDay_(env, userId, minutes) {
  const id = String(userId || "").trim();
  const amount = Math.max(0, Math.floor(Number(minutes) || 0));
  if (!id || amount <= 0) return;

  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS StudyDays (
        date TEXT NOT NULL,
        userId TEXT NOT NULL,
        studyMinutes INTEGER NOT NULL,
        PRIMARY KEY (date, userId)
      )
    `),
    env.DB.prepare(`
      INSERT INTO StudyDays (date, userId, studyMinutes)
      VALUES (?, ?, ?)
      ON CONFLICT(date, userId) DO UPDATE SET
        studyMinutes = studyMinutes + excluded.studyMinutes
    `).bind(today_(), id, amount)
  ]);
}

export async function studyStreaks_(env, userIds) {
  const ids = [...new Set(
    userIds.map(userId => String(userId || "").trim()).filter(Boolean)
  )];
  if (!ids.length) return new Map();

  const placeholders = ids.map(() => "?").join(", ");
  const [, result] = await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS StudyDays (
        date TEXT NOT NULL,
        userId TEXT NOT NULL,
        studyMinutes INTEGER NOT NULL,
        PRIMARY KEY (date, userId)
      )
    `),
    env.DB.prepare(`
      SELECT userId, date
      FROM StudyDays
      WHERE userId IN (${placeholders})
        AND studyMinutes > 0
      ORDER BY userId, date DESC
    `).bind(...ids)
  ]);
  const datesByUser = new Map();
  for (const row of result.results || []) {
    const id = String(row.userId);
    if (!datesByUser.has(id)) datesByUser.set(id, []);
    datesByUser.get(id).push(String(row.date));
  }

  const today = today_();
  const yesterday = shiftDate_(today, -1);
  const streaks = new Map();
  for (const id of ids) {
    const dates = datesByUser.get(id) || [];
    if (!dates.length || (dates[0] !== today && dates[0] !== yesterday)) {
      streaks.set(id, 0);
      continue;
    }
    let streak = 1;
    for (let index = 1; index < dates.length; index++) {
      if (dates[index] !== shiftDate_(dates[index - 1], -1)) break;
      streak++;
    }
    streaks.set(id, streak);
  }
  return streaks;
}

export async function studyStreak_(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return 0;

  const [, result] = await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS StudyDays (
        date TEXT NOT NULL,
        userId TEXT NOT NULL,
        studyMinutes INTEGER NOT NULL,
        PRIMARY KEY (date, userId)
      )
    `),
    env.DB.prepare(`
      SELECT date
      FROM StudyDays
      WHERE userId = ?
        AND studyMinutes > 0
      ORDER BY date DESC
    `).bind(id)
  ]);

  const dates = (result.results || []).map(row => String(row.date));
  if (!dates.length) return 0;

  const today = today_();
  const yesterday = shiftDate_(today, -1);
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let index = 1; index < dates.length; index++) {
    if (dates[index] !== shiftDate_(dates[index - 1], -1)) break;
    streak++;
  }

  return streak;
}

export async function studyDays_(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return 0;

  const [, result] = await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS StudyDays (
        date TEXT NOT NULL,
        userId TEXT NOT NULL,
        studyMinutes INTEGER NOT NULL,
        PRIMARY KEY (date, userId)
      )
    `),
    env.DB.prepare(`
      SELECT COUNT(*) AS days
      FROM StudyDays
      WHERE userId = ?
        AND studyMinutes > 0
    `).bind(id)
  ]);

  return Math.max(0, Number(result?.days) || 0);
}

export async function studyDaysByName_(env, username) {
  const query = String(username || "").trim();
  if (!query) {
    return "ユーザー名を指定してください。";
  }

  const member = await env.DB.prepare(`
    SELECT userId, displayName
    FROM Members
    WHERE TRIM(displayName) = ?
    LIMIT 1
  `).bind(query).first();

  if (!member) {
    return `「${query}」というメンバーは見つかりませんでした。`;
  }

  const days = await studyDays_(env, member.userId);
  const name = String(member.displayName || "名前未設定");
  return `## ${name}の勉強日数\n` +
    `---\n` +
    `**勉強日数**　　　　　　${days}日`;
}