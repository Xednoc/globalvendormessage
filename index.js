require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");

const PORT = process.env.PORT || 10000;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN?.trim();
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET?.trim();

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  console.error("🚨 Faltan variables de entorno SLACK_BOT_TOKEN o SLACK_SIGNING_SECRET");
  process.exit(1);
}

// Receiver
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",
});

// Bolt App
const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// Slash Command de prueba
app.command("/ping", async ({ ack, body }) => {
  await ack(`🏓 Pong! Tu user ID es <@${body.user_id}>`);
});

// Iniciar servidor
(async () => {
  await app.start(PORT);
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
})();
