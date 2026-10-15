import { CONFIG } from "./config.js";
import { carryMinutes_, members_, setCarry_ } from "./member.js";
import { db_, ensureSocietyTables_, societySystem_, state_, setState_ } from "./democracy.js";

export async function applyCommunism_(env, members) {
  if (!members.length) throw new Error("Communism failed: no member rows found.");
  const values = members.map(member => {
    const minutes = Number(member.carryMinutes);
    if (!Number.isFinite(minutes)) throw new Error("Invalid carryMinutes for userId " + member.userId);
    return Math.max(0, Math.floor(minutes));
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  const base = Math.floor(total / values.length);
  await db_(env).batch(members.map((member, index) => db_(env).prepare("UPDATE Members SET carryMinutes = ? WHERE userId = ?").bind(base + (index < total % values.length ? 1 : 0), member.userId)));
  return { members: members.length, totalMinutes: total };
}

export async function perestroika_(env, forRevolution = false) {
  await ensureSocietyTables_(env);
  if (!forRevolution && await societySystem_(env) !== "communism") return "現在の社会体制が**共産主義**ではないため、ペレストロイカ機能は使えません。";
  const last = Number(await state_(env, "perostroikaCooldown") || 0);
  const remaining = last + CONFIG.PEROSTROIKA_COOLDOWN * 1000 - Date.now();
  if (!forRevolution && remaining > 0) {
    const seconds = Math.ceil(remaining / 1000);
    return ["⏳ ペレストロイカはクールダウン中です！", `あと${Math.floor(seconds / 60)}分${seconds % 60}秒お待ちください。`].join("\n");
  }
  const members = await members_(env);
  if (!members.length) return "対象メンバーがいません。";
  const updates = members.map(member => {
    const minutes = Number(member.carryMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error("Invalid carryMinutes value.");
    return { member, minutes: Math.floor(minutes / 2) };
  });
  await db_(env).batch(updates.map(update => db_(env).prepare("UPDATE Members SET carryMinutes = ? WHERE userId = ?").bind(update.minutes, update.member.userId)));
  await setState_(env, "perostroikaCooldown", Date.now());
  const before = updates.reduce((sum, update) => sum + Number(update.member.carryMinutes), 0);
  const after = updates.reduce((sum, update) => sum + update.minutes, 0);
  return ["## 🕊️ ペレストロイカ完了！", "---", "全メンバーの持ち越し時間を半減しました。", `対象人数：**${updates.length}人**`, `変更前合計：**${before}分**`, `**変更後合計：**${after}分**`, `削減時間：**${before - after}分**`].join("\n");
}

export async function revolutionBonus_(env) {
  const members = await members_(env);
  if (!members.length) throw new Error("Revolution failed: no registered members found.");
  const winner = members[Math.floor(Math.random() * members.length)];
  const bonus = Number(CONFIG.REVOLUTION_BONUS_MINUTES);
  const current = await carryMinutes_(env, winner.userId);
  await setCarry_(env, winner.userId, current + bonus);
  return ["☠️ 革命発生！", winner.displayName + "が処刑され、ペナルティーが増加しました。", "追加：" + bonus + "分", "合計：" + (current + bonus) + "分"].join("\n");
}
