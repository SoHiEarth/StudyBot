import { YOSHIMIZU_RESPONSES } from "./special_responses.js";
import { refreshMemberProfile_ } from "./member.js";
import { getOverview_ } from "./overview.js";
import { getRanking_ } from "./ranking.js";

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
      
    default:
      break;
  }

  return {
    handled: true,
    answer: answer == null || String(answer).trim() === ""
      ? "処理できる回答がありませんでした。"
      : String(answer)
  };
}