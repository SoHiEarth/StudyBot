import { YOSHIMIZU_RESPONSES, pairs, gambleUsage_ } from "./special_responses.js";

export function getFastAnswer_(event) {
  const userId = event.source && event.source.userId;
  if (userId == "Ud4b21d16769707e877baea669277ea93") {
    if (event.type === "message" || event.message?.type === "text") {
      if (event.message.text.trim().startsWith("/追加") ||
        event.message.text.trim().startsWith("/目標") ||
        event.message.text.trim().startsWith("/社会") ||
        event.message.text.trim().startsWith("/概要") ||
        event.message.text.trim().startsWith("/時間")) return null;
    }
    const index = Math.floor(Math.random() * YOSHIMIZU_RESPONSES.length);
    return YOSHIMIZU_RESPONSES[index];
  }
  if (
    event.type !== "message" ||
    event.message?.type !== "text"
  ) {
    return null;
  }
  const text = event.message.text.trim();

  if (text.startsWith("/教育")) {
    const match = text.match(/^\/教育\s+(.+)$/);

    return match
      ? {
        imageBeforeText: true,
        text: `${match[1]}っているのかな？`
      }
      : null;
  }

  if (text.startsWith("/否定")) {
    const match = text.match(/^\/否定\s+(.+)$/);

    return match
      ? {
        imageBeforeText: true,
        text: `${match[1]}っていらないよね。`
      }
      : null;
  }

  if (text.startsWith("/賭ける")) {
    const match = text.match(
      /^\/賭ける(?:\s+(\d+)(?:\s+(低|中|高|狂気))?)?$/
    );

    if (!match || match[1] === undefined) {
      return gambleUsage_();
    }

    return null;
  }

  if (text.startsWith("/追加")) {
    const match = text.match(/^\/追加\s+(\d+)$/);
    if (!match || Number(match[1]) <= 0 ||
      Number(match[1]) > 1440) {
      return [
        "## 使い方",
        "---",
        "**/追加 n**",
        "*nは1から1440の正の整数。（分）*"
      ].join("\n");
    } else {
      return null;
    }
  }

  if (text.includes("https://news.yahoo.co.jp/articles/")) {
    return "稲村のヤフーニュースきた";
  }

  if (text.startsWith("/目標")) {
    const match = text.match(/^\/目標\s+(\d+)$/);
    if (!match || Number(match[1]) <= 0 ||
      Number(match[1]) > 1440) {
      return [
        "## 使い方",
        "---",
        "**/目標 n**",
        "*nは1から1440の正の整数。（分）*"
      ].join("\n");
    } else {
      return null;
    }
  }

  return Object.hasOwn(pairs, text)
    ? pairs[text]
    : null;
}

export function formatAnswer_(answer) {
  if (typeof answer !== "string") return answer;

  const hasMarkdown =
    /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|---+\s*$)|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|`[^`\n]+`|\*[^*\n]+\*|(?<!\*)\*[^*\n]+\*(?!\*)|\[[^\]]+\]\(https?:\/\/[^ )]+\)/.test(answer);

  if (!hasMarkdown) {
    return { type: "text", text: answer };
  }

  const spans = [];
  const plainLines = [];
  let inCodeBlock = false;

  function addSpan(text, style = {}) {
    if (!text) return;
    spans.push({ type: "span", text, ...style });
  }

  function inline(text) {
    const re =
      /(`[^`\n]+`|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+\*|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|\[[^\]]+\]\(https?:\/\/[^ )]+\))/g;

    let pos = 0;
    let m;

    while ((m = re.exec(text)) !== null) {
      addSpan(text.slice(pos, m.index));
      const token = m[0];
      if (token.startsWith("`")) {
        addSpan(token.slice(1, -1), {
          color: "#5c5c5cff",
          weight: "bold"
        });
      } else if (token.startsWith("**") ||
        token.startsWith("__")) {
        addSpan(token.slice(2, -2), { weight: "bold" });
      } else if (token.startsWith("~~")) {
        addSpan(token.slice(2, -2), {
          decoration: "line-through"
        });
      } else if (token.startsWith("*") ||
        token.startsWith("_")) {
        addSpan(token.slice(1, -1), { style: "italic" });
      } else {
        const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^ )]+)\)$/);

        if (link) {
          addSpan(link[1], {
            color: "#5c5c5cff",
            decoration: "underline"
          });
        } else {
          addSpan(token);
        }
      }
      pos = re.lastIndex;
    }
    addSpan(text.slice(pos));
  }

  const lines = answer.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) addSpan("\n");
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      addSpan(line, {
        color: "#5c5c5cff",
        weight: "bold"
      });
      plainLines.push(line);
      continue;
    }

    // Horizontal rule
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      addSpan("────────────", { color: "#999999" });
      plainLines.push("────────────");
      continue;
    }

    // Headings: # through ######
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);

    if (heading) {
      const sizes = {
        1: "xxl",
        2: "xl",
        3: "lg",
        4: "md",
        5: "sm",
        6: "sm"
      };

      const content = heading[2];
      const headingSize = sizes[heading[1].length];

      // Apply inline formatting while retaining heading size.
      const before = spans.length;
      inline(content);

      for (let j = before; j < spans.length; j++) {
        spans[j].weight = "bold";
        spans[j].size = headingSize;
      }

      plainLines.push(content);
      continue;
    }

    // Blockquotes
    const quote = line.match(/^\s{0,3}>\s?(.*)$/);

    if (quote) {
      addSpan("│ ", { color: "#888888" });
      const before = spans.length;
      inline(quote[1]);

      for (let j = before; j < spans.length; j++) {
        if (!spans[j].color) spans[j].color = "#777777";
      }

      plainLines.push("> " + quote[1]);
      continue;
    }

    // Unordered list
    const bullet = line.match(/^(\s*)[-*+]\s+(.+)$/);

    if (bullet) {
      addSpan(bullet[1] + "• ");
      inline(bullet[2]);
      plainLines.push(bullet[1] + "• " + bullet[2]);
      continue;
    }

    // Numbered list
    const numbered = line.match(/^(\s*)(\d+)\.\s+(.+)$/);

    if (numbered) {
      addSpan(numbered[1] + numbered[2] + ". ");
      inline(numbered[3]);
      plainLines.push(
        numbered[1] + numbered[2] + ". " + numbered[3]
      );
      continue;
    }

    inline(line);

    // Plain-text version for notifications
    plainLines.push(
      line
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/~~(.*?)~~/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^ )]+)\)/g, "$1")
    );
  }

  return {
    type: "flex",
    altText: plainLines.join("\n").slice(0, 400),
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            contents: spans.length
              ? spans
              : [{ type: "span", text: " " }],
            wrap: true
          }
        ]
      }
    }
  };
}