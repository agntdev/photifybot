import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { FREE_QUOTA, PAYMENT_LINK } from "../bot.js";

const composer = new Composer<Ctx>();

const GENERATING = "⏳ Generating 4 variants…";
const ERROR_MSG =
  "⚠️ Couldn't generate the variants. The service may be temporarily unavailable — try again in a moment.";
const QUOTA_EXCEEDED =
  "🚫 You've used all 10 free generations.\n\n" +
  "Buy more credits to keep generating:";

function resultKeyboard() {
  return inlineKeyboard([
    [
      inlineButton("🔄 Regenerate", "action:regenerate"),
      inlineButton("🔍 Upscale", "action:upscale"),
    ],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
}

composer.callbackQuery("option:variants", async (ctx) => {
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
    const imageUrls: string[] = [];

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
          n: 4,
          size: "1024x1024",
          response_format: "url",
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as { data: Array<{ url: string }> };
      for (const item of data.data) {
        imageUrls.push(item.url);
      }
    } else {
      for (let i = 1; i <= 4; i++) {
        imageUrls.push(
          `https://via.placeholder.com/1024x1024.png?text=Variant+${i}`,
        );
      }
    }

    const buffers: Buffer[] = [];
    for (const url of imageUrls) {
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error("Image download failed");
      buffers.push(Buffer.from(await imgRes.arrayBuffer()));
    }

    ctx.session.quota = (ctx.session.quota ?? FREE_QUOTA) - 1;
    ctx.session.lastJob = {
      prompt,
      variantCount: 4,
      imageUrls,
    };
    ctx.session.pendingPrompt = undefined;
    ctx.session.step = "idle";

    const remaining = ctx.session.quota ?? 0;
    const caption = `4 variants for: "${prompt}"\n\n${remaining} free generations remaining.`;

    await ctx.replyWithPhoto(
      new InputFile(buffers[0]),
      {
        caption,
        reply_markup: resultKeyboard(),
      },
    );

    for (let i = 1; i < buffers.length; i++) {
      await ctx.replyWithPhoto(new InputFile(buffers[i]));
    }
  } catch {
    await ctx.reply(ERROR_MSG, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Try again", "option:variants")],
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
