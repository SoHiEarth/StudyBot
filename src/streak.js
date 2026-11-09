import { shiftDate_, today_ } from "./date.js";

async function ensureStudyDays_(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS StudyDays (
      date TEXT NOT NULL,
      userId TEXT NOT NULL,
      studyMinutes INTEGER NOT NULL,
      PRIMARY KEY (date, userId)
    )
  `).run();
}

export async function recordStudyDay_(env, userId, minutes) {
  const id = String(userId || "").trim();
  const amount = Math.max(0, Math.floor(Number(minutes) || 0));
  if (!id || amount <= 0) return;

  await ensureStudyDays_(env);

  await env.DB.prepare(`
    INSERT INTO StudyDays (date, userId, studyMinutes)
    VALUES (?, ?, ?)
    ON CONFLICT(date, userId) DO UPDATE SET
      studyMinutes = studyMinutes + excluded.studyMinutes
  `).bind(today_(), id, amount).run();
}

export async function studyStreak_(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return 0;

  await ensureStudyDays_(env);

  const result = await env.DB.prepare(`
    SELECT date
    FROM StudyDays
    WHERE userId = ?
      AND studyMinutes > 0
    ORDER BY date DESC
  `).bind(id).all();

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

  await ensureStudyDays_(env);

  const result = await env.DB.prepare(`
    SELECT COUNT(*) AS days
    FROM StudyDays
    WHERE userId = ?
      AND studyMinutes > 0
  `).bind(id).first();

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