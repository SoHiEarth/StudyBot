import { members_ } from "./member.js";
import { CONFIG } from "./config.js";
import { formatMinutes_, today_ } from "./date.js";

export async function getOverview_(env) {
  const today = today_();
  const examDate = CONFIG.EXAM_DATE;

  const remaining = Math.max(
    0,
    Math.round(
      (Date.parse(examDate) - Date.parse(today)) / 86400000
    )
  );

  const members = await members_(env);
  const lines = [`## 共通テストまで${remaining}日`, "---"];

  for (const m of members) {
    const actual = Math.max(0, Number(m.studyMinutes) || 0);
    const carry = Math.max(0, Number(m.carryMinutes) || 0);
    const target = Math.min(
      CONFIG.DAILY_CAP,
      m.dailyGoal + carry
    );

    lines.push(
      `#### ${m.displayName}`,
      `　目標　　　　：${formatMinutes_(target)}`,
      `　ペナルティー：${formatMinutes_(carry)}`,
      `　勉強時間　　：${formatMinutes_(actual)}`,
      ""
    );
  }

  lines.push("*目標はペナルティーを含む。*");
  return lines.join("\n");
}