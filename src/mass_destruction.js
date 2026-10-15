import { CONFIG } from "./config.js";
import {
  members_,
  carryMinutes_,
  setCarry_
} from "./member.js";
import { rouletteMaxPenalty_ } from "./roulette.js";
import { formatMinutes_ } from "./date.js";

export async function massDestruction_(env, source) {
  // D1 operations are asynchronous, so use your D1-compatible
  // locking mechanism here if concurrent executions are possible.

  const allMembers = await members_(env);

  if (allMembers.length === 0) {
    return "登録メンバーがいません。";
  }

  const now = new Date();
  const results = [];
  const skipped = [];

  for (const member of allMembers) {
    const maxPenalty = Math.floor(
      await rouletteMaxPenalty_(env, member.userId, now)
    );

    if (maxPenalty < CONFIG.ROULETTE_MIN_PENALTY) {
      skipped.push(member.displayName);
      continue;
    }

    const upper = Math.min(
      CONFIG.ROULETTE_MAX_PENALTY,
      maxPenalty
    );

    const penalty =
      CONFIG.ROULETTE_MIN_PENALTY +
      Math.floor(
        Math.random() *
        (upper - CONFIG.ROULETTE_MIN_PENALTY + 1)
      );

    const currentCarry = await carryMinutes_(env, member.userId);

    await setCarry_(
      env,
      member.userId,
      currentCarry + penalty
    );

    results.push(
      `- ${member.displayName}: **${formatMinutes_(penalty)}**`
    );
  }

  if (results.length === 0) {
    return "達成可能なペナルティーを課せるメンバーがいません。";
  }

  const message = [
    "## 無差別攻撃発動",
    "---",
    ...results,
    "ペナルティーが加算されました。"
  ];

  if (skipped.length > 0) {
    message.push(
      "",
      "今回は対象外:",
      skipped.map(name => `・${name}`).join("\n"),
      "（今日中に目標とペナルティーが達成できないため）"
    );
  }

  message.push(
    "",
    "*未達成分は既存の精算機能により翌日へ繰り越されます。*"
  );

  return message.join("\n");
}