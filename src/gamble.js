import { CONFIG } from "./config.js";

export async function gamble(env, userId, ante, risk = "中") {
  userId = String(userId || "").trim();
  ante = Number(ante);

  if (!userId) {
    return "ユーザーを確認できません。";
  }

  if (!Number.isSafeInteger(ante) || ante < 1) {
    return "アンティは1分以上の整数にしてください。";
  }

  const settings = {
    "低": {
      winChance: 50,
      winMult: 0.25,
      lossMult: 0.5
    },
    "中": {
      winChance: 35,
      winMult: 0.4,
      lossMult: 0.8
    },
    "高": {
      winChance: 25,
      winMult: 0.65,
      lossMult: 1.5
    },
    "狂気": {
      winChance: 10,
      winMult: 1,
      lossMult: 200
    }
  };

  const config = settings[risk];

  if (!config) {
    return "リスクは「低」「中」「高」「狂気」から選んでください。";
  }

  try {
    const db = env.DB;
    const now = Date.now();
    const cooldownMs = CONFIG.GAMBLE_COOLDOWN_SECONDS * 1000;
    const [cooldownResult, memberResult] = await db.batch([
      db.prepare(
        "SELECT lastGamble FROM GambleCooldowns WHERE userId = ?"
      ).bind(userId),
      db.prepare(
        "SELECT carryMinutes FROM Members WHERE userId = ?"
      ).bind(userId)
    ]);

    const cooldown = cooldownResult.results?.[0];
    const member = memberResult.results?.[0];
    const lastGamble = Number(cooldown?.lastGamble || 0);
    const remainingMs = lastGamble + cooldownMs - now;

    if (remainingMs > 0) {
      return formatGambleCooldown_(remainingMs);
    }

    if (!member) return "ユーザーが登録されていません。";

    const current = Math.max(0, Number(member.carryMinutes) || 0);
    if (current <= 0) return "ペナルティがないため賭けられません！";
    if (ante > current) {
      return `現在のペナルティは${current}分です。アンティを減らしてください。`;
    }

    const roll = Math.random() * 100;
    let delta;
    let message;

    if (roll < config.winChance) {
      delta = -Math.max(1, Math.round(ante * config.winMult));
      message = "🎉 勝利！ペナルティが減少しました。";
    } else if (roll >= 97) {
      delta = Math.round(ante * config.lossMult * 3);
      message = "💀 大失敗！ペナルティ激増しました。";
    } else {
      delta = Math.round(ante * config.lossMult);
      message = "😈 敗北！ペナルティ増加しました。";
    }

    const next = Math.max(0, current + delta);
    const cooldownCondition = cooldown
      ? "EXISTS (SELECT 1 FROM GambleCooldowns WHERE userId = ? AND lastGamble = ?)"
      : "NOT EXISTS (SELECT 1 FROM GambleCooldowns WHERE userId = ?)";
    const conditionBindings = cooldown
      ? [userId, lastGamble]
      : [userId];

    const update = await db.batch([
      db.prepare(`
        UPDATE Members
        SET carryMinutes = ?
        WHERE userId = ?
          AND carryMinutes = ?
          AND ${cooldownCondition}
      `).bind(next, userId, current, ...conditionBindings)
    ]);

    if (update[0].meta.changes !== 1) {
      return "別のギャンブル処理が実行されました。少し待ってから再試行してください。";
    }

    await db.batch([
      db.prepare(`
        INSERT INTO GambleCooldowns (userId, lastGamble)
        VALUES (?, ?)
        ON CONFLICT(userId)
        DO UPDATE SET lastGamble = excluded.lastGamble
      `).bind(userId, now)
    ]);

    const changeText = delta < 0
      ? `${Math.abs(delta)}分減少`
      : `${delta}分増加`;

    return [
      "## 🎰 ペナルティ・ギャンブル",
      "---",
      message,
      `⚠️ リスク: **${risk}**`,
      `💰 アンティ: **${ante}分**`,
      `📊 結果: **${changeText}**`,
      `⏱️ ペナルティ: **${current}分 → ${next}分**`
    ].join("\n");
  } catch (error) {
    console.error("Gamble failed:", error);
    return "ギャンブルの処理に失敗しました。もう一度お試しください。";
  }
}

function formatGambleCooldown_(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `⏳ クールダウン中です！あと${minutes}分${seconds}秒待ってください。`;
}