require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");

const PORT = process.env.PORT || 10000;

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET.trim(),
  endpoints: "/slack/events", // aquí Slack enviará los eventos y la verificación
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN.trim(),
  receiver,
});

// Slash command de prueba
app.command("/ping", async ({ ack, body }) => {
  await ack(`🏓 Pong! Tu user ID es <@${body.user_id}>`);
});

// Inicia servidor
(async () => {
  await app.start(PORT);
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
})();
