import { formatAnswer_ } from "./answer.js";
import { handleEvent_ } from "./event.js";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const body = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (
      !signature ||
      !(await verifySignature(
        body,
        signature,
        env.LINE_CHANNEL_SECRET
      ))
    ) {
      return new Response("Invalid signature", { status: 401 });
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const events = data.events || [];

    ctx.waitUntil(
      Promise.all(
        events.map(async (event) => {
          if (!event.replyToken) return;

          try {
            const result = await handleEvent_(event, env);

            if (!result || result.handled !== true) {
              return;
            }

            const ok = await replyDirectly(
              event.replyToken,
              result.answer,
              env
            );

            if (!ok) {
              console.error(
                "Failed to reply to event:",
                event.webhookEventId || "(no event ID)"
              );
            }
          } catch (error) {
            console.error(
              "Event processing failed:",
              event.webhookEventId || "(no event ID)",
              error
            );
          }
        })
      )
    );

    return new Response("OK", { status: 200 });
  }
};

async function verifySignature(body, signature, secret) {
  if (!secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );

  const bytes = new Uint8Array(digest);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const expected = btoa(binary);

  if (expected.length !== signature.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return diff === 0;
}

async function replyDirectly(replyToken, answer, env) {
  try {
    const messages = [];

    if (
      typeof answer === "object" &&
      answer !== null &&
      answer.imageBeforeText
    ) {
      const imageUrl =
        "https://www.saitamaheisei.ed.jp/wp-content/uploads/2025/07/25jh-B-02.jpg";

      messages.push({
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl
      });

      messages.push(formatAnswer_(answer.text));
    } else {
      messages.push(formatAnswer_(answer));
    }

    const response = await fetch(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          replyToken,
          messages
        }),
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      console.error(
        "LINE reply failed:",
        response.status,
        await response.text()
      );
    }

    return response.ok;
  } catch (error) {
    console.error("LINE reply request failed:", error);
    return false;
  }
}