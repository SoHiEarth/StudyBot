import { pairs, YOSHIMIZU_RESPONSES } from "./special_responses.js";
import { refreshMemberProfile_ } from "./member.js";
import { getOverview_ } from "./overview.js";
import { getRanking_ } from "./ranking.js";
import { addStudyTime_ } from "./study.js";
import {
  getMyTime_,
  getTimeByName_,
  setGoal_
} from "./goal.js";
import {
  joinRoulette_,
  startRoulette_,
  ListRouletteParticipants,
  ForceJoinAll
} from "./roulette.js";
import { massDestruction_ } from "./mass_destruction.js";
import { getSlackerList_ } from "./slacker.js";
import { gamble } from "./gamble.js";
import {
  applyCurrentSocietySystemTraits_,
  getDemocracyPolicyStatus_,
  getSocietyStatus_,
  voteForSocietySystem_,
  voteOnPolicy_
} from "./democracy.js";
import { perestroika_ } from "./communism.js";
import { voteOnExecution_, getExecutionStatus_ } from "./execution.js";

export async function handleEvent_(event, env) {
  if (
    !event || event.type !== "message" ||
    !event.message || event.message.type !== "text"
  ) {
    return { handled: false };
  }

  const text = event.message.text.trim();
  const userId = event.source?.userId;

  if (!userId) {
    return { handled: false };
  }

  const source = event.source;

  if (userId == "Ud4b21d16769707e877baea669277ea93") {
    if (event.type === "message" || event.message?.type === "text") {
      if (text.startsWith("/追加") ||
        text.startsWith("/目標") ||
        text.startsWith("/社会") ||
        text.startsWith("/概要") ||
        text.startsWith("/時間")) return null;
    }
    const index = Math.floor(Math.random() * YOSHIMIZU_RESPONSES.length);
    return { handled: true, answer: YOSHIMIZU_RESPONSES[index] };
  }

  let answer;
  let match;
  switch (text) {
    case "/概要":
      await refreshMemberProfile_(env, event.source, userId);
      answer = await getOverview_(env);
      break;

    case "/ランキング":
      answer = await getRanking_(env, "today");
      break;

    case "/週間ランキング":
      answer = await getRanking_(env, "week");
      break;

    case "/月間ランキング":
      answer = await getRanking_(env, "month");
      break;

    case "/累計ランキング":
      answer = await getRanking_(env, "all");
      break;

    case "/ルーレット参加":
      answer = await joinRoulette_(env, source, userId);
      break;

    case "/ルーレット開始":
      answer = await startRoulette_(env, source);
      break;

    case "/ルーレット参加者":
      answer = await ListRouletteParticipants(env, source);
      break;

    case "/無差別攻撃":
      answer = await massDestruction_(env, event.source);
      break;

    case "/さぼり":
      answer = await getSlackerList_(env);
      break;

    case "/社会":
      answer = await getSocietyStatus_(env);
      break;

    case "/政策":
      answer = await getDemocracyPolicyStatus_(env);
      break;

    case "/革命":
      answer = await applyCurrentSocietySystemTraits_(env);
      break;

    case "/ペレストロイカ":
      answer = await perestroika_(env);
      break;

    case "/処刑状況":
      answer = await getExecutionStatus_(env);
      break;

    default:
      if ((match = text.match(/^\/追加(?:\s+(\d+))?$/))) {
        const minutes = match[1];
        if (minutes) {
          answer = await addStudyTime_(env, userId, Number(minutes));
        } else {
          answer = [
            "使い方",
            "---",
            "/追加 <勉強時間>",
            "追加する勉強時間を指定してください。"
          ].join("\n");
        }
      } else if ((match = text.match(/^\/目標(?:\s+(\d+))?$/))) {
        const minutes = match[1];
        if (minutes) {
          answer = await setGoal_(env, userId, Number(minutes));
        } else {
          answer = [
            "使い方",
            "---",
            "/目標 <目標時間>",
            "目標時間を指定してください。"
          ].join("\n");
        }
      } else if ((match = text.match(/^\/時間(?:\s+(.+))?$/))) {
        const username = match[1];
        if (username) {
          answer = await getTimeByName_(env, username);
        } else {
          answer = await getMyTime_(env, userId);
        }
      } else if (/^\/巻き込む\s+確定$/.test(text)) {
        answer = ForceJoinAll(env, event.source, userId);
      } else if (
        (match = text.match(
          /^\/社会\s+(共産主義|資本主義|民主主義)$/
        ))
      ) {
        const systemMap = {
          "共産主義": "communism",
          "資本主義": "capitalism",
          "民主主義": "democracy"
        };
        answer = await voteForSocietySystem_(
          env,
          userId,
          systemMap[match[1]]
        );
      } else if (
        (match = text.match(
          /^\/賭ける\s+(\d+)(?:\s+(低|中|高|狂気))?$/
        ))
      ) {
        answer = await gamble(
          env,
          userId,
          Number(match[1]),
          match[2] || "中"
        );
      } else if (
        (match = text.match(
          /^\/政策\s+(ペナルティ軽減|抽選確率アップ)\s+(賛成|反対)$/
        ))
      ) {
        answer = await voteOnPolicy_(env, userId, match[1], match[2]);
      } else if (
        (match = text.match(/^\/処刑\s+(.+?)\s+(賛成|反対)$/))
      ) {
        answer = await voteOnExecution_(
          env,
          userId,
          match[1].trim(),
          match[2]
        );
      } else if (Object.hasOwn(pairs, text)) {
        answer = pairs[text];
      } else {
        return { handled: false };
      }
  }

  return {
    handled: true,
    answer: answer == null || String(answer).trim() === ""
      ? "処理できる回答がありませんでした。"
      : String(answer)
  };
}