import { members_, studyMinutes_ } from "./member.js";
import { today_ } from "./date.js";

export async function getSlackerList_(env) {
  const allMembers = await members_(env);
  const today = today_();

  if (allMembers.length === 0) {
    return "メンバーがまだ登録されていません。";
  }

  const membersWithTime = await Promise.all(
    allMembers.map(async member => ({
      ...member,
      minutes: await studyMinutes_(env, member.userId, today)
    }))
  );

  const slackers = membersWithTime.filter(
    member => member.minutes === 0
  );

  if (slackers.length === 0) {
    return "全員が勉強時間を記録済み\nさぼっている人はいません。";
  }

  const lines = [
    "## 🚨 さぼりランキング",
    "---",
    `勉強時間が0分の人：**${slackers.length}人**`,
    ""
  ];

  slackers.forEach(member => {
    lines.push(`- **${member.displayName}**`);
  });

  return lines.join("\n");
}