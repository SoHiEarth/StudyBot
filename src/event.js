import { YOSHIMIZU_RESPONSES } from "./special_responses.js";
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
    case "/だれや":
    case "/誰や":
      answer = "うるさい";
      break;

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