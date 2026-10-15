import { members_ } from "./member.js";
import {
  formatMinutes_,
  monthStart_,
  today_,
  weekStart_
} from "./date.js";

export async function getRanking_(env, period) {
  const today = today_();
  let startDate = "2026-01-01";
  let title = "累計ランキング";

  const db = env.DB;

  if (period === "today") {
    title = "今日のランキング";

    const members = await members_(env);

    const ranked = members
      .map(m => ({
        name: m.displayName,
        minutes: Number(m.studyMinutes) || 0
      }))
      .sort((a, b) => b.minutes - a.minutes);

    if (ranked.length === 0) {
      return `${title}\nまだメンバーが登録されていません。`;
    }

    const lines = [`## 🏆 ${title}`, "---"];

    ranked.forEach((m, i) => {
      lines.push(
        `${i + 1}位 **${m.name}**：${formatMinutes_(m.minutes)}`
      );
    });

    return lines.join("\n");
  }

  if (period === "week") {
    startDate = weekStart_(today);
    title = "週間ランキング（月曜～今日）";
  } else if (period === "month") {
    startDate = monthStart_(today);
    title = "月間ランキング";
  }

  const result = await db.prepare(`
    SELECT userId, SUM(studyMinutes) AS total
    FROM DailySettlements
    WHERE date >= ? AND date <= ?
    GROUP BY userId
  `).bind(startDate, today).all();

  const totals = new Map(
    (result.results || []).map(row => [
      String(row.userId).trim(),
      Number(row.total) || 0
    ])
  );

  const members = await members_(env);

  const ranked = members
    .map(m => ({
      name: m.displayName,
      minutes: totals.get(String(m.userId).trim()) || 0
    }))
    .sort((a, b) => b.minutes - a.minutes);

  if (ranked.length === 0) {
    return `${title}\nまだメンバーが登録されていません。`;
  }

  const lines = [`## 🏆 ${title}`, "---"];

  ranked.forEach((m, i) => {
    lines.push(
      `${i + 1}位 **${m.name}**：${formatMinutes_(m.minutes)}`
    );
  });

  return lines.join("\n");
}