import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import { WebClient } from "@slack/web-api";
import BoltPkg from "@slack/bolt";  // <- IMPORT DEFAULT
const { App, ExpressReceiver } = BoltPkg; // <- Extraer desde default


// =====================================
// Variables de entorno
// =====================================
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
// Admins
// =====================================
const ADMINS = ["U0839LCBZ4Y"];

// =====================================
// Lista de canales
// =====================================
const canales = [
  { label: "Canal 1", value: "C06M1AYMSTU" },
  { label: "Canal 2", value: "C06M1B1JLAW" },
  { label: "Canal 3", value: "C06LLQQDT0F" },
  { label: "Canal 4", value: "C06LUNGPVGE" },
  { label: "Canal 5", value: "C06MQ5R42QY" },
  { label: "Canal 6", value: "C06LYE9NZ53" },
  { label: "Canal 7", value: "C06M1B41JJW" },
  { label: "Canal 8", value: "C06MQ62H0KS" },
];

// =====================================
// Logging
// =====================================
function saveLog(user, message, channels) {
  const logEntry = { user, message, channels, timestamp: new Date().toISOString() };
  const logFile = "message_log.json";
  let logs = [];
  if (fs.existsSync(logFile)) logs = JSON.parse(fs.readFileSync(logFile));
  logs.push(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}

function filterLogs({ user, channel, keyword }) {
  const logFile = "message_log.json";
  if (!fs.existsSync(logFile)) return [];
  let logs = JSON.parse(fs.readFileSync(logFile));
  if (user) logs = logs.filter(l => l.user === user);
  if (channel) logs = logs.filter(l => l.channels.includes(channel));
  if (keyword) logs = logs.filter(l => l.message.toLowerCase().includes(keyword.toLowerCase()));
  return logs;
}

// =====================================
// Express nativo
// =====================================
const expressApp = express();
expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: true }));

// Endpoint para que Slack valide URL (url_verification)
expressApp.post("/slack/events", (req, res, next) => {
  const { type, challenge } = req.body;
  if (type === "url_verification") {
    console.log("✅ Challenge recibido de Slack:", challenge);
    return res.status(200).send(challenge); // Slack espera exactamente esto
  }
  next(); // pasar al receiver de Bolt para otros eventos
});

// =====================================
// ExpressReceiver de Bolt
// =====================================
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",
  expressApp, // reutilizamos el express existente
});

// =====================================
// Bolt App
// =====================================
const boltApp = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

const web = new WebClient(SLACK_BOT_TOKEN);

// =====================================
// Slash Command: /globalvendormessage
// =====================================
boltApp.command("/globalvendormessage", async ({ ack, body, client }) => {
  await ack();

  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "global_message_modal",
        title: { type: "plain_text", text: "Enviar mensaje" },
        submit: { type: "plain_text", text: "Enviar" },
        close: { type: "plain_text", text: "Cancelar" },
        blocks: [
          {
            type: "input",
            block_id: "message_block",
            label: { type: "plain_text", text: "Mensaje" },
            element: { type: "plain_text_input", multiline: true, action_id: "message_input" },
          },
          {
            type: "input",
            block_id: "channels_block",
            label: { type: "plain_text", text: "Selecciona canales" },
            element: {
              type: "multi_static_select",
              placeholder: { type: "plain_text", text: "Elige los canales" },
              options: canales.map(c => ({ text: { type: "plain_text", text: c.label }, value: c.value })),
              action_id: "channels_select",
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("❌ Error abriendo modal:", error);
  }
});

// =====================================
// Modal Submission
// =====================================
boltApp.view("global_message_modal", async ({ ack, body, view, client }) => {
  await ack();
  const message = view.state.values.message_block.message_input.value;
  const selectedChannels = view.state.values.channels_block.channels_select.selected_options.map(c => c.value);
  saveLog(body.user.id, message, selectedChannels);

  for (const channel of selectedChannels) {
    try {
      await web.chat.postMessage({ channel, text: message });
    } catch (error) {
      console.error(`Error al enviar a ${channel}:`, error.data || error.message);
    }
  }

  await client.chat.postMessage({
    channel: body.user.id,
    text: `✅ Mensaje enviado a ${selectedChannels.length} canal(es).`,
  });
});

// =====================================
// Slash Command: /logs
// =====================================
boltApp.command("/logs", async ({ ack, body, client }) => {
  await ack();
  const userId = body.user_id;

  if (!ADMINS.includes(userId)) {
    return client.chat.postEphemeral({
      channel: userId,
      user: userId,
      text: "❌ No tienes permiso para ver los logs.",
    });
  }

  const logs = filterLogs({});
  if (logs.length === 0) {
    return client.chat.postEphemeral({ channel: userId, user: userId, text: "No hay mensajes en el log." });
  }

  await sendLogsMessage(client, userId, logs, 0, 20);
});

async function sendLogsMessage(client, userId, logs, start, end) {
  const pageLogs = logs.slice(start, end).map(l => ({
    type: "section",
    text: { type: "mrkdwn", text: `*Usuario:* <@${l.user}>\n*Mensaje:* ${l.message}\n*Canales:* ${l.channels.map(c => `<#${c}>`).join(", ")}\n*Hora:* ${l.timestamp}` },
  }));

  const actions = [];
  if (start > 0) actions.push({ type: "button", text: { type: "plain_text", text: "⬅️ Anterior" }, value: `${start}-${end}`, action_id: "prev_logs" });
  if (end < logs.length) actions.push({ type: "button", text: { type: "plain_text", text: "➡️ Siguiente" }, value: `${start}-${end}`, action_id: "next_logs" });

  const blocks = [...pageLogs];
  if (actions.length > 0) blocks.push({ type: "actions", elements: actions });

  await client.chat.postEphemeral({ channel: userId, user: userId, blocks });
}

// =====================================
// Inicializar servidor
// =====================================
(async () => {
  await boltApp.start(PORT);
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
})();
