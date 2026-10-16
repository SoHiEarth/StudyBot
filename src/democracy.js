import { CONFIG } from "./config.js";
import { members_ } from "./member.js";
import { applyCommunism_, revolutionBonus_ } from "./communism.js";
import { applyCapitalism_ } from "./capitalism.js";

export const SOCIETY_SYSTEMS_ = {
  communism: "共産主義",
  capitalism: "資本主義",
  democracy: "民主主義"
};

export const POLICY_CONFIG_ = {
  penalty_relief: { name: "ペナルティ軽減", property: "DEMOCRACY_PENALTY_RELIEF" },
  lottery_boost: { name: "抽選確率アップ", property: "DEMOCRACY_LOTTERY_BOOST" }
};

export function db_(env) {
  if (!env?.DB) throw new Error("D1 database binding DB is not configured.");
  return env.DB;
}

export async function ensureSocietyTables_(env) {
  await db_(env).batch([
    db_(env).prepare(`CREATE TABLE IF NOT EXISTS AppSettings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
    db_(env).prepare(`CREATE TABLE IF NOT EXISTS SocietyState (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
    db_(env).prepare(`CREATE TABLE IF NOT EXISTS Elections (userId TEXT PRIMARY KEY, system TEXT NOT NULL)`),
    db_(env).prepare(`CREATE TABLE IF NOT EXISTS PolicyVotes (userId TEXT NOT NULL, policy TEXT NOT NULL, vote TEXT NOT NULL, updatedAt INTEGER NOT NULL, PRIMARY KEY (userId, policy))`),
    db_(env).prepare(`CREATE TABLE IF NOT EXISTS ExecutionVotes (userId TEXT NOT NULL, targetUserId TEXT NOT NULL, vote TEXT NOT NULL, updatedAt INTEGER NOT NULL, PRIMARY KEY (userId, targetUserId))`)
  ]);
  await db_(env).prepare(`INSERT INTO AppSettings (key, value) SELECT key, value FROM SocietyState WHERE key = 'SOCIETY_SYSTEM' ON CONFLICT(key) DO NOTHING`).run();
}

export async function state_(env, key) {
  const row = await db_(env).prepare("SELECT value FROM SocietyState WHERE key = ?").bind(key).first();
  return row?.value ?? null;
}

export async function setState_(env, key, value) {
  await db_(env).prepare(`INSERT INTO SocietyState (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, String(value)).run();
}

export async function societySystem_(env) {
  const row = await db_(env).prepare("SELECT value FROM AppSettings  WHERE key = ?").bind("SOCIETY_SYSTEM").first();
  return row?.value || "normal";
}

export function threshold_(count) { return Math.floor(count / 2) + 1; }
export function memberIdSet_(members) { return new Set(members.map(member => String(member.userId || "").trim()).filter(Boolean)); }

async function voteCounts_(env, members) {
  const counts = Object.fromEntries(Object.keys(SOCIETY_SYSTEMS_).map(system => [system, 0]));
  const ids = memberIdSet_(members);
  const result = await db_(env).prepare("SELECT userId, system FROM Elections ORDER BY rowid").all();
  const votes = new Map();
  for (const row of result.results || []) {
    const userId = String(row.userId || "").trim();
    if (ids.has(userId) && Object.hasOwn(counts, row.system)) votes.set(userId, row.system);
  }
  for (const system of votes.values()) counts[system]++;
  return counts;
}

export async function getSocietyStatus_(env) {
  await ensureSocietyTables_(env);
  const system = await societySystem_(env);
  const members = await members_(env);
  const counts = await voteCounts_(env, members);
  const lines = ["## 社会状況", "---", "現在の体制：" + (SOCIETY_SYSTEMS_[system] || (system === "normal" ? "通常体制" : system)), "登録メンバー：" + members.length + "人", "可決に必要な票数：" + threshold_(members.length) + "票", "", "## 各制度への投票", "---"];
  for (const key of Object.keys(SOCIETY_SYSTEMS_)) lines.push(SOCIETY_SYSTEMS_[key] + "：" + counts[key] + "票");
  return lines.join("\n");
}

export async function voteForSocietySystem_(env, userId, system) {
  const id = String(userId || "").trim();
  if (!id) return "ユーザーを確認できませんでした。";
  if (!Object.hasOwn(SOCIETY_SYSTEMS_, system)) return "指定された社会制度は存在しません。";
  await ensureSocietyTables_(env);
  const members = await members_(env);
  if (!members.length) return "登録メンバーがいません。";
  if (!memberIdSet_(members).has(id)) return "登録メンバーのみ投票できます。";
  await db_(env).prepare(`INSERT INTO Elections (userId, system) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET system = excluded.system`).bind(id, system).run();
  const counts = await voteCounts_(env, members);
  const threshold = threshold_(members.length);
  const lines = ["## 社会制度への投票", "---", SOCIETY_SYSTEMS_[system] + "に投票しました。", "", "登録メンバー：" + members.length + "人", "可決に必要な票数：" + threshold + "票", ""];
  for (const key of Object.keys(SOCIETY_SYSTEMS_)) lines.push(SOCIETY_SYSTEMS_[key] + "：" + counts[key] + "票");
  const passed = Object.keys(counts).find(key => counts[key] >= threshold);
  if (!passed) return lines.concat(["", "まだ制度変更に必要な票数に達していません。"]).join("\n");
  const current = await societySystem_(env);
  if (passed === current) return lines.concat(["", "この制度はすでに適用されています。"]).join("\n");
  try {
    if (passed === "communism") await applyCommunism_(env, members);
    if (passed === "capitalism") await applyCapitalism_(env, members);
    await db_(env).prepare(`INSERT INTO AppSettings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind("SOCIETY_SYSTEM", passed).run();
  } catch (error) {
    console.error("Failed to apply society system:", error);
    return lines.concat(["", "制度変更の処理に失敗しました。", "現在の体制は変更されていません。", "管理者に確認してください。"]).join("\n");
  }
  return lines.concat(["", "投票成立！", "新しい社会体制：" + SOCIETY_SYSTEMS_[passed]]).join("\n");
}

function policyKey_(name) { return { "ペナルティ軽減": "penalty_relief", "抽選確率アップ": "lottery_boost" }[name]; }
function policyVote_(vote) { return { "賛成": "yes", "反対": "no" }[vote]; }

export async function voteOnPolicy_(env, userId, policyName, voteName) {
  const id = String(userId || "").trim();
  const policy = policyKey_(policyName);
  const vote = policyVote_(voteName);
  if (!id) return "ユーザーを確認できませんでした。";
  if (!policy || !vote) return "投票コマンドを確認してください。";
  await ensureSocietyTables_(env);
  if (await societySystem_(env) !== "democracy") return "現在の社会体制が**民主主義**ではないため、政策機能は使えません。";
  const members = await members_(env);
  if (!memberIdSet_(members).has(id)) return "登録メンバーのみ投票できます。";
  await db_(env).prepare(`INSERT INTO PolicyVotes (userId, policy, vote, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(userId, policy) DO UPDATE SET vote = excluded.vote, updatedAt = excluded.updatedAt`).bind(id, policy, vote, Date.now()).run();
  const result = await db_(env).prepare("SELECT userId, vote FROM PolicyVotes WHERE policy = ? ORDER BY updatedAt, rowid").bind(policy).all();
  const votes = new Map();
  const ids = memberIdSet_(members);
  for (const row of result.results || []) if (ids.has(String(row.userId).trim())) votes.set(row.userId, row.vote);
  let yes = 0; let no = 0;
  for (const answer of votes.values()) answer === "yes" ? yes++ : no++;
  const passed = yes >= threshold_(members.length);
  await setState_(env, POLICY_CONFIG_[policy].property, passed ? "true" : "false");
  return ["## 政策投票結果", "---", POLICY_CONFIG_[policy].name, "", "賛成：" + yes + "票", "反対：" + no + "票", "可決に必要な票数：" + threshold_(members.length) + "票", "", passed ? "政策可決！" : "政策は未可決です。", passed ? "この政策の効果が有効になりました。" : "この政策の効果は現在無効です。"].join("\n");
}

export async function getDemocracyPolicyStatus_(env) {
  await ensureSocietyTables_(env);
  if (await societySystem_(env) !== "democracy") return "現在の社会体制が**民主主義**ではないため、政策機能は使えません。";
  const lines = ["## 民主主義の政策", "---", "現在の体制：民主主義", ""];
  for (const config of Object.values(POLICY_CONFIG_)) lines.push(config.name + "：" + ((await state_(env, config.property)) === "true" ? "有効" : "無効"));
  return lines.concat(["", "投票方法：", "/政策 ペナルティ軽減 賛成", "/政策 ペナルティ軽減 反対", "/政策 抽選確率アップ 賛成", "/政策 抽選確率アップ 反対"]).join("\n");
}

export async function applyCurrentSocietySystemTraits_(env) {
  await ensureSocietyTables_(env);
  const system = await societySystem_(env);
  if (system === "normal") throw new Error("The normal system has no implemented traits.");
  const members = await members_(env);
  if (system === "communism") await applyCommunism_(env, members);
  if (system === "capitalism") await applyCapitalism_(env, members);
  const revolution = await revolutionBonus_(env);
  return [
    system === "communism" ? "共産主義の革命が成功しました。" :
      system === "capitalism" ? "資本主義革命が成功しました。" : "完了。",
    revolution
  ].join("\n\n");
}

export async function isDemocracyPolicyActive_(env, policy) {
  const config = POLICY_CONFIG_[policy];
  return Boolean(config && await societySystem_(env) === "democracy" && await state_(env, config.property) === "true");
}
export async function getPenaltyMultiplier_(env, policy) { return policy === "penalty_relief" && await isDemocracyPolicyActive_(env, policy) ? 0.5 : 1; }
export async function getLotteryChanceMultiplier_(env) { return await isDemocracyPolicyActive_(env, "lottery_boost") ? 2 : 1; }
