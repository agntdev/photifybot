import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { FREE_QUOTA } from "../bot.js";

const composer = new Composer<Ctx>();

const PROMPT_PROMPT = "✏️ Send me a description of the image you want to create.";
const QUOTA_EXCEEDED =
  "🚫 You've used all 10 free generations.\n\n" +
  "Buy more credits to keep generating:";
const EXPIRED = "⏱ Flow timed out. Tap /start to begin again.";

composer.callbackQuery("prompt:submit", async (ctx) => {
  await ctx.answerCallbackQuery();

  if ((ctx.session.quota ?? FREE_QUOTA) <= 0) {
    const kb = inlineKeyboard([
      [inlineButton("💳 Buy credits", "https://buy.stripe.com/imagebot")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);
    await ctx.reply(QUOTA_EXCEEDED, { reply_markup: kb });
    return;
  }

  ctx.session.step = "awaiting_prompt";
  ctx.session.flowExpiresAt = Date.now() + 5 * 60 * 1000;
  await ctx.reply(PROMPT_PROMPT, {
    reply_markup: { force_reply: true, selective: false },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_prompt") return next();

  if (ctx.session.flowExpiresAt && Date.now() > ctx.session.flowExpiresAt) {
    ctx.session.step = "idle";
    ctx.session.flowExpiresAt = undefined;
    await ctx.reply(EXPIRED);
    return;
  }

  const text = ctx.message.text.trim();
  if (text.length < 3) {
    await ctx.reply("Prompt is too short — give me a bit more detail.");
    return;
  }

  ctx.session.pendingPrompt = text;
  ctx.session.step = "prompt_submitted";
  ctx.session.flowExpiresAt = undefined;

  const kb = inlineKeyboard([
    [
      inlineButton("🖼 Single image", "option:single"),
      inlineButton("🎨 Variants (4)", "option:variants"),
    ],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  await ctx.reply(
    `Got it! Here's what you asked for:\n\n"${text}"\n\nHow would you like to generate it?`,
    { reply_markup: kb },
  );
});

export default composer;
