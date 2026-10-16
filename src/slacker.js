import { members_ } from "./member.js";

export async function getSlackerList_(env) {
  const allMembers = await members_(env);

  if (allMembers.length === 0) {
    return "メンバーがまだ登録されていません。";
  }

  const membersWithTime = allMembers.map(member => ({
    ...member,
    minutes: Math.max(0, Number(member.studyMinutes) || 0)
  }));

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