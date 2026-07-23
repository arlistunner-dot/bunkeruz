import "dotenv/config";
import { Telegraf, Markup } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const VOICE_CHAT_URL = process.env.VOICE_CHAT_URL || "";

function isHttpsUrl(url) {
  return typeof url === "string" && url.startsWith("https://");
}

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN .env ichida topilmadi");
}

export const bot = new Telegraf(BOT_TOKEN);

const rulesText = `
📜 <b>Bunker qoidalari</b>

🃏 Har bir o‘yinchiga maxfiy kartalar beriladi:
• Kasb
• Yosh
• Sog‘liq
• Xarakter
• Fobiya
• Hobbi
• Inventar
• Maxsus karta

👀 Siz o‘z kartalaringizni ko‘ra olasiz.
🔒 Boshqalar sizning kartalaringizni ko‘rmaydi.
📢 “Hammaga ochish” bosilganda karta barcha o‘yinchilarga ko‘rinadi.

💬 Bahslashing, o‘zingizni himoya qiling va bunkerga kirishga harakat qiling.

🗳 Har 2 ta karta ochish raundidan keyin ovoz berish boshlanadi.
🏆 Oxirida bunkerda qolganlar g‘olib bo‘ladi.
`;

const startText = `
🕳 <b>Bunker</b>

Apokalipsis boshlandi. Bunkerda joylar cheklangan.

Siz va do‘stlaringizga turli kartalar beriladi. Kim bunkerga kirishga loyiq, kim tashqarida qoladi — buni sizlarning bahsingiz, strategiyangiz va ovozingiz hal qiladi.

🎮 <b>O‘yin qanday o‘tadi?</b>
• Xona yarating yoki kod orqali kiring
• Kartalaringizni ko‘rib chiqing
• Kerakli kartani hammaga oching
• Chatda o‘zingizni himoya qiling
• Ovoz berib, kim qolishini hal qiling

🔥 <b>Eng muhimi:</b>
Bu o‘yin hazil, bahs, strategiya va do‘stlar bilan kulgi uchun.
`;

function mainMenu() {
  const rows = [];

  if (isHttpsUrl(FRONTEND_URL)) {
    rows.push([
      Markup.button.webApp("🎮 O‘yinni boshlash", FRONTEND_URL)
    ]);
  } else {
    rows.push([
      Markup.button.callback("🎮 Mini App tayyor emas", "miniapp_not_ready")
    ]);
  }

  rows.push([
    Markup.button.callback("📜 Qoidalar", "rules")
  ]);

  if (isHttpsUrl(VOICE_CHAT_URL)) {
    rows.push([
      Markup.button.url("🎙 Voice chat", VOICE_CHAT_URL)
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

async function sendStart(ctx) {
  await ctx.reply(startText, {
    parse_mode: "HTML",
    ...mainMenu()
  });
}

bot.start(sendStart);

bot.command("play", async (ctx) => {
  await sendStart(ctx);
});

bot.command("rules", async (ctx) => {
  await ctx.reply(rulesText, {
    parse_mode: "HTML",
    ...mainMenu()
  });
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    `🆘 <b>Yordam</b>

🎮 O‘yinni boshlash uchun pastdagi tugmani bosing.
👥 Do‘stlaringizni xonaga kod orqali chaqiring.
🃏 Kartani ustiga bossangiz — faqat o‘zingiz ko‘rasiz.
📢 “Hammaga ochish” bossangiz — karta hammaga ko‘rinadi.

Savol tug‘ilsa, o‘yin ichidagi chatdan foydalaning.`,
    {
      parse_mode: "HTML",
      ...mainMenu()
    }
  );
});

bot.action("rules", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(rulesText, {
    parse_mode: "HTML",
    ...mainMenu()
  });
});

bot.action("miniapp_not_ready", async (ctx) => {
  await ctx.answerCbQuery("Mini App URL hali HTTPS qilib ulanmagan.");
  await ctx.reply(
    `⚠️ <b>Mini App hozircha ochilmayapti</b>

FRONTEND_URL .env ichida HTTPS link bo‘lishi kerak.

Hozirgi FRONTEND_URL:
<code>${FRONTEND_URL || "yozilmagan"}</code>`,
    { parse_mode: "HTML" }
  );
});

bot.hears(["🎮 O‘yinni boshlash", "O‘yinni boshlash", "play", "Play", "start"], async (ctx) => {
  await sendStart(ctx);
});

bot.catch((err) => {
  console.error("Telegram bot xatosi:", err);
});

export function printBotInfo() {
  console.log("✅ Bunker Telegram bot tayyor.");
  console.log(`FRONTEND_URL: ${FRONTEND_URL || "yozilmagan"}`);
  console.log(`Mini App HTTPS: ${isHttpsUrl(FRONTEND_URL) ? "ha" : "yo‘q"}`);
}

export async function startPollingBot() {
  printBotInfo();
  await bot.launch();
  console.log("🤖 Bot polling rejimida ishga tushdi.");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

const isDirectRun =
  process.argv[1] &&
  process.argv[1].replaceAll("\\", "/").endsWith("/bot.js");

if (isDirectRun) {
  startPollingBot().catch((err) => {
    console.error("Botni ishga tushirishda xato:", err);
    process.exit(1);
  });
}