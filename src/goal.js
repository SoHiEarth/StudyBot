export async function setGoal_(env, userId, minutes) {
  const id = String(userId || "").trim();
  const goal = Number(minutes);

  if (!id) {
    return "ユーザーを確認できませんでした。";
  }

  if (
    !Number.isSafeInteger(goal) ||
    goal < 1 ||
    goal > CONFIG.MAX_GOAL
  ) {
    return `目標は1～${CONFIG.MAX_GOAL}分で設定してください。`;
  }

  await ensureMember_(env, id);

  await env.DB.prepare(`
    UPDATE Members
    SET dailyGoal = ?
    WHERE userId = ?
  `).bind(goal, id).run();

  return `目標を**${formatMinutes_(goal)}**に設定しました。\n` +
    `ペナルティーは別途加算されます。`;
}

export async function getMyTime_(env, userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return "ユーザーを確認できませんでした。";
  }

  await ensureMember_(env, id);

  const m = await env.DB.prepare(`
    SELECT userId, displayName, studyMinutes, dailyGoal, carryMinutes
    FROM Members
    WHERE userId = ?
    LIMIT 1
  `).bind(id).first();

  if (!m) {
    return "メンバー情報を取得できませんでした。";
  }

  const name = String(m.displayName || "名前未設定");
  const actual = Math.max(0, Number(m.studyMinutes) || 0);
  const goal = Math.min(
    CONFIG.MAX_GOAL,
    Math.max(1, Number(m.dailyGoal) || CONFIG.DEFAULT_GOAL)
  );
  const carry = Math.max(0, Number(m.carryMinutes) || 0);
  const target = Math.min(CONFIG.DAILY_CAP, goal + carry);

  return `## ${name}の時間\n` +
    `---\n` +
    `**勉強時間**　　　　　　${formatMinutes_(actual)}\n` +
    `**目標**　　　　　　　　${formatMinutes_(goal)}\n` +
    `**ペナルティー**　　　　${formatMinutes_(carry)}\n` +
    `**目標＋ペナルティー**　${formatMinutes_(target)}\n` +
    `**残り**　　　　　　　　${formatMinutes_(Math.max(0, target - actual))}`;
}

export async function getTimeByName_(env, username) {
  const query = String(username || "").trim();

  if (!query) {
    return "ユーザー名を指定してください。";
  }

  const m = await env.DB.prepare(`
    SELECT userId, displayName, studyMinutes, dailyGoal, carryMinutes
    FROM Members
    WHERE TRIM(displayName) = ?
    LIMIT 1
  `).bind(query).first();

  if (!m) {
    return `「${query}」というメンバーは見つかりませんでした。`;
  }

  const name = String(m.displayName || "名前未設定");
  const actual = Math.max(0, Number(m.studyMinutes) || 0);
  const goal = Math.min(
    CONFIG.MAX_GOAL,
    Math.max(1, Number(m.dailyGoal) || CONFIG.DEFAULT_GOAL)
  );
  const carry = Math.max(0, Number(m.carryMinutes) || 0);
  const target = Math.min(CONFIG.DAILY_CAP, goal + carry);

  return `## ${name}の時間\n` +
    `---\n` +
    `**勉強時間**　　　　　　${formatMinutes_(actual)}\n` +
    `**目標**　　　　　　　　${formatMinutes_(goal)}\n` +
    `**ペナルティー**　　　　${formatMinutes_(carry)}\n` +
    `**目標＋ペナルティー**　${formatMinutes_(target)}\n` +
    `**残り**　　　　　　　　${formatMinutes_(Math.max(0, target - actual))}`;
}