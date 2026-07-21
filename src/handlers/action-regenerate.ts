import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { FREE_QUOTA, PAYMENT_LINK } from "../bot.js";

const composer = new Composer<Ctx>();

const NO_JOB = "No previous generation to regenerate. Tap 🎨 Generate to create one.";
const GENERATING = "⏳ Regenerating…";
const ERROR_MSG =
  "⚠️ Couldn't regenerate the image. Try again in a moment.";
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

composer.callbackQuery("action:regenerate", async (ctx) => {
  await ctx.answerCallbackQuery();

  const lastJob = ctx.session.lastJob;
  if (!lastJob) {
    await ctx.reply(NO_JOB, {
      reply_markup: inlineKeyboard([
        [inlineButton("🎨 Generate", "prompt:submit")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  if ((ctx.session.quota ?? FREE_QUOTA) <= 0) {
    const kb = inlineKeyboard([
      [inlineButton("💳 Buy credits", PAYMENT_LINK)],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);
    await ctx.reply(QUOTA_EXCEEDED, { reply_markup: kb });
    return;
  }

  const prompt = lastJob.prompt;
  const isVariants = lastJob.variantCount > 1;

  await ctx.replyWithChatAction("upload_photo");

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const imageUrls: string[] = [];
    const count = isVariants ? 4 : 1;

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
          n: count,
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
      for (let i = 1; i <= count; i++) {
        imageUrls.push(
          `https://via.placeholder.com/1024x1024.png?text=Regenerated+${i}`,
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
      variantCount: count,
      imageUrls,
    };

    const remaining = ctx.session.quota ?? 0;
    const label = isVariants ? "4 variants" : "image";
    const caption = `Regenerated ${label} for: "${prompt}"\n\n${remaining} free generations remaining.`;

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
        [inlineButton("🔄 Try again", "action:regenerate")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });

    try {
      const adminId = process.env.ADMIN_TELEGRAM_ID;
      if (adminId) {
        await ctx.api.sendMessage(
          Number(adminId),
          `⚠️ Regeneration error for user ${ctx.from?.id}: ${prompt}`,
        );
      }
    } catch {
      // Admin notification is best-effort
    }
  }
});

export default composer;
