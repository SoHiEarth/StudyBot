import { CONFIG } from "./config.js";
import { carryMinutes_, findMember_, members_, setCarry_ } from "./member.js";
import { db_, ensureSocietyTables_, memberIdSet_, societySystem_, threshold_ } from "./democracy.js";

export async function getExecutionStatus_(env) {
  await ensureSocietyTables_(env);
  const system = await societySystem_(env);
  if (system === "communism") return ["## 処刑システム", "---", "現在の体制：共産主義", "処刑投票は不要です。", "対象を指定すると即時処刑されます。"].join("\n");
  if (system !== "democracy") return "現在の社会体制では処刑できません。";
  const members = await members_(env);
  const ids = memberIdSet_(members);
  const result = await db_(env).prepare("SELECT userId, targetUserId, vote FROM ExecutionVotes ORDER BY updatedAt, rowid").all();
  const targets = new Map();
  for (const row of result.results || []) {
    if (!ids.has(row.userId) || !ids.has(row.targetUserId) || !["yes", "no"].includes(row.vote)) continue;
    if (!targets.has(row.targetUserId)) targets.set(row.targetUserId, new Map());
    targets.get(row.targetUserId).set(row.userId, row.vote);
  }
  const lines = ["## 処刑投票状況", "---", "可決条件：登録メンバーの過半数", "必要票数：" + threshold_(members.length) + "票", ""];
  if (!targets.size) lines.push("現在、投票はありません。");
  for (const [targetId, votes] of targets) {
    let yes = 0; let no = 0;
    for (const vote of votes.values()) vote === "yes" ? yes++ : no++;
    const target = members.find(member => member.userId === targetId);
    lines.push("対象：" + (target?.displayName || targetId), "賛成：" + yes + "票 / 反対：" + no + "票", yes >= threshold_(members.length) ? "投票可決" : "未可決", "");
  }
  return lines.concat(["投票方法：", "/処刑 対象メンバーID 賛成", "/処刑 対象メンバーID 反対"]).join("\n");
}

export async function voteOnExecution_(env, userId, targetName, voteName) {
  const voterId = String(userId || "").trim();
  const requestedName = String(targetName || "").trim().toLowerCase();
  const vote = { "賛成": "yes", "反対": "no" }[voteName];
  if (!voterId) return "ユーザーを確認できませんでした。";
  if (!vote || !requestedName) return "投票コマンドを確認してください。";
  await ensureSocietyTables_(env);
  const system = await societySystem_(env);
  if (system !== "democracy" && system !== "communism") return "現在の社会体制では処刑できません。";
  const members = await members_(env);
  if (!memberIdSet_(members).has(voterId)) return "登録メンバーのみ投票できます。";
  const matches = members.filter(member => String(member.displayName || "").trim().toLowerCase() === requestedName);
  if (!matches.length) return "「" + targetName + "」というメンバーが見つかりません。\n登録されているユーザー名を確認してください。";
  if (matches.length > 1) return "「" + targetName + "」という名前のメンバーが複数います。\n区別できる名前に変更してから投票してください。";
  const target = matches[0];
  if (voterId === target.userId) return "自分自身には投票できません。";
  if (system === "communism") return executeMember_(env, target.userId);
  await db_(env).prepare(`INSERT INTO ExecutionVotes (userId, targetUserId, vote, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(userId, targetUserId) DO UPDATE SET vote = excluded.vote, updatedAt = excluded.updatedAt`).bind(voterId, target.userId, vote, Date.now()).run();
  const result = await db_(env).prepare("SELECT userId, vote FROM ExecutionVotes WHERE targetUserId = ? ORDER BY updatedAt, rowid").bind(target.userId).all();
  const latest = new Map();
  for (const row of result.results || []) latest.set(row.userId, row.vote);
  let yes = 0; let no = 0;
  for (const answer of latest.values()) answer === "yes" ? yes++ : no++;
  const threshold = threshold_(members.length);
  return ["## 処刑投票結果", "---", "対象：" + target.displayName, "賛成：" + yes + "票", "反対：" + no + "票", "可決に必要な票数：" + threshold + "票", "", yes >= threshold ? "処刑投票が可決されました。" : "処刑投票は未可決です。", "", yes >= threshold ? "投票は可決されましたが、実際の処刑処理は別途必要です。" : "必要な賛成票に達していません。"].join("\n");
}

async function executeMember_(env, targetUserId) {
  const member = await findMember_(env, targetUserId);
  if (!member) return "対象のメンバーが見つかりません。";
  const penalty = Math.max(0, Math.floor(Number(CONFIG.EXECUTION_MINUTES) || 0));
  const current = await carryMinutes_(env, targetUserId);
  await setCarry_(env, targetUserId, current + penalty);
  return ["## 処刑執行", "---", "対象：" + member.displayName, "処刑が執行されました。", "追加ペナルティ：" + penalty + "分", "累積持ち越し：" + (current + penalty) + "分", "対象は登録メンバーとして維持されます。"].join("\n");
}
