import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { FREE_QUOTA, PAYMENT_LINK } from "../bot.js";

const composer = new Composer<Ctx>();

const GENERATING = "⏳ Generating your image…";
const ERROR_MSG =
  "⚠️ Couldn't generate the image. The service may be temporarily unavailable — try again in a moment.";
const QUOTA_EXCEEDED =
  "🚫 You've used all 10 free generations.\n\n" +
  "Buy more credits to keep generating:";

function resultKeyboard(jobId: string) {
  return inlineKeyboard([
    [
      inlineButton("🔄 Regenerate", "action:regenerate"),
      inlineButton("🔍 Upscale", "action:upscale"),
    ],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
}

composer.callbackQuery("option:single", async (ctx) => {
  await ctx.answerCallbackQuery();

  if ((ctx.session.quota ?? FREE_QUOTA) <= 0) {
    const kb = inlineKeyboard([
      [inlineButton("💳 Buy credits", PAYMENT_LINK)],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);
    await ctx.reply(QUOTA_EXCEEDED, { reply_markup: kb });
    return;
  }

  const prompt = ctx.session.pendingPrompt;
  if (!prompt) {
    await ctx.reply("No prompt found. Tap /start to begin again.");
    return;
  }

  await ctx.replyWithChatAction("upload_photo");

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    let imageUrl: string;

    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "url",
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as { data: Array<{ url: string }> };
      imageUrl = data.data[0].url;
    } else {
      imageUrl =
        "https://via.placeholder.com/1024x1024.png?text=Generated+Image";
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Image download failed");
    const buf = Buffer.from(await imgRes.arrayBuffer());

    ctx.session.quota = (ctx.session.quota ?? FREE_QUOTA) - 1;
    ctx.session.lastJob = {
      prompt,
      variantCount: 1,
      imageUrls: [imageUrl],
    };
    ctx.session.pendingPrompt = undefined;
    ctx.session.step = "idle";

    const remaining = ctx.session.quota ?? 0;
    await ctx.replyWithPhoto(
      new InputFile(buf),
      {
        caption: `Generated for: "${prompt}"\n\n${remaining} free generations remaining.`,
        reply_markup: resultKeyboard("single"),
      },
    );
  } catch {
    await ctx.reply(ERROR_MSG, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Try again", "option:single")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });

    try {
      const adminId = process.env.ADMIN_TELEGRAM_ID;
      if (adminId) {
        await ctx.api.sendMessage(
          Number(adminId),
          `⚠️ Image generation error for user ${ctx.from?.id}: ${prompt}`,
        );
      }
    } catch {
      // Admin notification is best-effort
    }
  }
});

export default composer;
