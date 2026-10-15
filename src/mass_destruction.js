export async function massDestruction_(source) {
  // D1 operations are asynchronous, so use your D1-compatible
  // locking mechanism here if concurrent executions are possible.

  const allMembers = await members_();

  if (allMembers.length === 0) {
    return "登録メンバーがいません。";
  }

  const now = new Date();
  const results = [];
  const skipped = [];

  for (const member of allMembers) {
    const maxPenalty = Math.floor(
      await rouletteMaxPenalty_(member.userId, now)
    );

    if (maxPenalty < CONFIG.ROULETTE_MIN_PENALTY) {
      skipped.push(member.name);
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

    const currentCarry = await carryMinutes_(member.userId);

    await setCarry_(
      member.userId,
      currentCarry + penalty
    );

    results.push(
      `- ${member.name}: **${formatMinutes_(penalty)}**`
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