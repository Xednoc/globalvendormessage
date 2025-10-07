require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");

const PORT = process.env.PORT || 10000;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN?.trim();
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET?.trim();

console.log("=======================================");
console.log("DEBUG: Verificando variables de entorno");
console.log("SLACK_BOT_TOKEN =", SLACK_BOT_TOKEN ? "✅ OK" : "❌ MISSING");
console.log("SLACK_SIGNING_SECRET =", SLACK_SIGNING_SECRET ? "✅ OK" : "❌ MISSING");
if (SLACK_SIGNING_SECRET) console.log("Longitud del secret:", SLACK_SIGNING_SECRET.length);
console.log("=======================================");

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  console.error("🚨 ERROR: Faltan variables de entorno SLACK_BOT_TOKEN o SLACK_SIGNING_SECRET");
  process.exit(1);
}

// =====================================
// ExpressReceiver de Bolt
// =====================================
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",
});

// Manejo del challenge para verificación de URL
receiver.app.post("/slack/events", (req, res, next) => {
  if (req.body?.type === "url_verification") {
    console.log("✅ Recibido challenge de Slack:", req.body.challenge);
    return res.status(200).send(req.body.challenge);
  }
  next();
});

// =====================================
// Bolt App
// =====================================
const boltApp = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// =====================================
// Slash Command de prueba: /ping
// =====================================
boltApp.command("/ping", async ({ ack, body, client }) => {
  await ack(`🏓 Pong! Tu user ID es <@${body.user_id}>`);
});

// =====================================
// Inicializar servidor
// =====================================
(async () => {
  await boltApp.start(PORT);
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
})();
