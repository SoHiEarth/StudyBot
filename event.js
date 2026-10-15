export function handleEvent_(event) {
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
    return YOSHIMIZU_RESPONSES[index];
  }

  let answer;
  switch (text) {
    case "/概要":
      refreshMemberProfile_(event.source, userId);
      answer = getOverview_();
      break;
    default:
      break;
  }

  return {
    handled: true,
    answer: answer == null ? "" : String(answer)
  };
}