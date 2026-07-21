import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  mainMenuKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";

registerMainMenuItem({ label: "🎨 Generate", data: "prompt:submit", order: 10 });

const WELCOME = "👋 Welcome! Tap a button below to get started.";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
