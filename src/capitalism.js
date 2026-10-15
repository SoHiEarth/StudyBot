import { db_ } from "./democracy.js";

export async function applyCapitalism_(env, members) {
  if (!members.length) throw new Error("Capitalism failed: no member rows found.");
  const values = members.map(member => {
    const minutes = Number(member.carryMinutes);
    if (!Number.isFinite(minutes)) throw new Error("Invalid carryMinutes for userId " + member.userId);
    return Math.max(0, Math.floor(minutes));
  });
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  await db_(env).batch(members.map((member, index) => {
    const difference = values[index] - average;
    const minutes = difference < 0
      ? Math.max(0, Math.floor(values[index] + difference))
      : Math.floor(values[index] + difference);
    return db_(env).prepare("UPDATE Members SET carryMinutes = ? WHERE userId = ?").bind(minutes, member.userId);
  }));
}
