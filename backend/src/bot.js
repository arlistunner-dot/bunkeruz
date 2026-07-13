import dotenv from "dotenv";
import { Telegraf, Markup } from "telegraf";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const VOICE_CHAT_URL = process.env.VOICE_CHAT_URL || "";

const rulesText = `
🎮 So‘nggi Joy — bunker uslubidagi strategik kartali o‘yin.

🧩 Maqsad:
Apokalipsisdan keyin bunkerga kim kirishini hal qilish.

👥 O‘yin:
1. Xona yaratiladi.
2. Do‘stlar xona kodi orqali qo‘shiladi.
3. Har bir o‘yinchiga maxfiy kartalar beriladi.
4. Har kim o‘z kartalarini ko‘radi, boshqalar esa ko‘rmaydi.
5. Har raundda har bir o‘yinchi istagan bitta kartasini ochadi.
6. O‘yinchilar ovozli chatda bahslashadi.
7. Har 2 raunddan keyin ovoz berish bo‘ladi.
8. Eng ko‘p ovoz olgan o‘yinchi bunkerdan chiqariladi.
9. Durang bo‘lsa, faqat durangdagi o‘yinchilar orasidan qayta ovoz beriladi.
10. Oxirida bunkerga kirganlar g‘olib bo‘ladi.

🎭 Strategiya:
Yaxshi kartalarni vaqtida oching, yomon kartalarni yashiring, boshqalarni ishontiring.
`;

function isHttpsUrl(url) {
  return typeof url === "string" && url.trim().startsWith("https://");
}

function mainMenu() {
  const buttons = [];

  if (isHttpsUrl(FRONTEND_URL)) {
    buttons.push([
      Markup.button.webApp("🎮 O‘yinni ochish", FRONTEND_URL)
    ]);
  } else {
    buttons.push([
      Markup.button.callback("🎮 O‘yinni ochish", "miniapp_not_ready")
    ]);
  }

  buttons.push([
    Markup.button.callback("📜 Qoidalar", "rules")
  ]);

  if (isHttpsUrl(VOICE_CHAT_URL) || VOICE_CHAT_URL.startsWith("https://t.me/")) {
    buttons.push([
      Markup.button.url("🎙 Ovozli chat guruhi", VOICE_CHAT_URL)
    ]);
  }

  return Markup.inlineKeyboard(buttons);
}

if (!BOT_TOKEN || BOT_TOKEN === "PASTE_YOUR_BOT_TOKEN_HERE") {
  console.log("");
  console.log("⚠️ BOT_TOKEN topilmadi.");
  console.log("backend\\.env faylini oching va BOT_TOKEN= joyiga BotFather tokenini yozing.");
  console.log("");
  process.exit(0);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  const firstName = ctx.from?.first_name || "o‘yinchi";

  await ctx.reply(
    `👋 Salom, ${firstName}!\n\n` +
    `Bu — So‘nggi Joy.\n\n` +
    `Bunkerga kim kiradi, kim tashqarida qoladi — buni sizlar hal qilasiz.\n\n` +
    `O‘yinni boshlash uchun tugmani bosing:`,
    mainMenu()
  );
});

bot.command("play", async (ctx) => {
  await ctx.reply("🎮 O‘yinni ochish:", mainMenu());
});

bot.command("rules", async (ctx) => {
  await ctx.reply(rulesText, mainMenu());
});

bot.action("rules", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(rulesText, mainMenu());
});

bot.action("miniapp_not_ready", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "⚠️ Mini App hali Telegram ichida ochilmaydi.\n\n" +
    "Sabab: Telegram Web App faqat HTTPS link qabul qiladi.\n\n" +
    `Hozirgi link: ${FRONTEND_URL || "FRONTEND_URL yozilmagan"}\n\n` +
    "Lokal test uchun brauzerda oching:\n" +
    "http://127.0.0.1:5173\n\n" +
    "Keyingi qadamda HTTPS tunnel yoki deploy qilib, bot tugmasini haqiqiy Mini Appga ulaymiz."
  );
});

bot.hears(["o‘ynash", "O‘ynash", "oyin", "Oyin", "play", "Play"], async (ctx) => {
  await ctx.reply("🎮 O‘yinni ochish:", mainMenu());
});

bot.catch((error) => {
  console.error("Bot xatosi:", error);
});

bot.launch({
  dropPendingUpdates: true
});

console.log("✅ So‘nggi Joy Telegram bot ishga tushdi.");
console.log("FRONTEND_URL:", FRONTEND_URL);
console.log("Mini App HTTPS:", isHttpsUrl(FRONTEND_URL) ? "ha" : "yo‘q");

process.once("SIGINT", () => {
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
});