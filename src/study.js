import { CONFIG } from "./config.js";
import { ensureMember_, studyMinutes_ } from "./member.js";
import { formatMinutes_ } from "./date.js";

export async function studyMinutesByUser_(env) {
  const result = await env.DB.prepare(`
    SELECT userId, studyMinutes
    FROM Members
  `).all();

  const totals = new Map();

  for (const row of result.results || []) {
    const userId = String(row.userId || "").trim();
    if (!userId) continue;

    const minutes = Number(row.studyMinutes);
    if (!Number.isFinite(minutes)) continue;

    totals.set(userId, Math.max(0, minutes));
  }

  return totals;
}

export async function addStudyTime_(env, userId, minutes) {
  const id = String(userId || "").trim();
  const amount = Number(minutes);

  if (!id) {
    throw new Error("userId is required.");
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return "追加する勉強時間は正の整数で指定してください。";
  }

  await ensureMember_(env, id);

  const db = env.DB;
  const cap = CONFIG.DAILY_CAP;

  // Atomically increment only if the daily cap is not exceeded.
  const result = await db.prepare(`
    UPDATE Members
    SET studyMinutes = COALESCE(studyMinutes, 0) + ?
    WHERE userId = ?
      AND COALESCE(studyMinutes, 0) + ? <= ?
  `).bind(amount, id, amount, cap).run();

  if (result.meta.changes === 0) {
    const actual = await studyMinutes_(env, id);

    // Distinguish a cap rejection from a missing member.
    const memberExists = await db.prepare(`
      SELECT 1 AS found
      FROM Members
      WHERE userId = ?
      LIMIT 1
    `).bind(id).first();

    if (!memberExists) {
      throw new Error("Member not found after ensureMember_.");
    }

    const remaining = Math.max(0, cap - actual);

    return `上限を超えるため、追加できません。\n` +
      `現在の記録：**${formatMinutes_(actual)}**\n` +
      `追加できる時間：**${formatMinutes_(remaining)}**\n` +
      `記録上限は${cap}分です。`;
  }

  const total = await studyMinutes_(env, id);

  return `**${amount}**分追加しました。\n` +
    `合計：**${formatMinutes_(total)}**`;
}