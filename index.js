require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { WebClient } = require("@slack/web-api");
const { App } = require("@slack/bolt");

const PORT = process.env.PORT || 3000;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

// Lista de IDs de usuarios admins
const ADMINS = ["TU_USER_ID"]; // reemplaza con tu Slack ID

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  console.error("ERROR: Faltan variables de entorno SLACK_BOT_TOKEN o SLACK_SIGNING_SECRET");
  process.exit(1);
}

// Inicializamos Express y Bolt
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const web = new WebClient(SLACK_BOT_TOKEN);

const boltApp = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  receiver: { app, dispatch: (payload) => Promise.resolve(payload) },
});

// Lista de canales disponibles
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

// -------------------- Función para guardar log --------------------
function saveLog(user, message, channels) {
  const logEntry = {
    user,
    message,
    channels,
    timestamp: new Date().toISOString(),
  };

  const logFile = "message_log.json";
  let logs = [];
  if (fs.existsSync(logFile)) {
    logs = JSON.parse(fs.readFileSync(logFile));
  }
  logs.push(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}

// -------------------- Función para filtrar logs --------------------
function filterLogs({ user, channel, keyword }) {
  const logFile = "message_log.json";
  if (!fs.existsSync(logFile)) return [];

  let logs = JSON.parse(fs.readFileSync(logFile));

  if (user) logs = logs.filter(l => l.user === user);
  if (channel) logs = logs.filter(l => l.channels.includes(channel));
  if (keyword) logs = logs.filter(l => l.message.toLowerCase().includes(keyword.toLowerCase()));

  return logs;
}

// -------------------- Slash Command para enviar mensaje --------------------
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
              options: canales.map(c => ({
                text: { type: "plain_text", text: c.label },
                value: c.value,
              })),
              action_id: "channels_select",
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error abriendo modal:", error);
  }
});

// -------------------- Interacción del modal --------------------
boltApp.view("global_message_modal", async ({ ack, body, view, client }) => {
  await ack();

  const message = view.state.values.message_block.message_input.value;
  const selectedChannels = view.state.values.channels_block.channels_select.selected_options.map(c => c.value);

  saveLog(body.user.id, message, selectedChannels);

  selectedChannels.forEach(async (channel) => {
    try {
      await web.chat.postMessage({ channel, text: message });
    } catch (error) {
      console.error(`Error al enviar a ${channel}:`, error.data || error.message);
    }
  });

  await client.chat.postMessage({
    channel: body.user.id,
    text: `✅ Mensaje enviado a ${selectedChannels.length} canal(es).`,
  });
});

// -------------------- Slash Command para ver logs interactivos --------------------
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
    return client.chat.postEphemeral({
      channel: userId,
      user: userId,
      text: "No hay mensajes en el log.",
    });
  }

  const startIndex = 0;
  const endIndex = 20; // <-- Cambiado de 5 a 20
  await sendLogsMessage(client, userId, logs, startIndex, endIndex);
});

// -------------------- Función para enviar logs con botones --------------------
async function sendLogsMessage(client, userId, logs, start, end) {
  const pageLogs = logs.slice(start, end).map(l => ({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Usuario:* <@${l.user}>\n*Mensaje:* ${l.message}\n*Canales:* ${l.channels.map(c => `<#${c}>`).join(", ")}\n*Hora:* ${l.timestamp}`,
    },
  }));

  const blocks = [...pageLogs];

  const actions = [];
  if (start > 0) actions.push({ type: "button", text: { type: "plain_text", text: "⬅️ Anterior" }, value: `${start}-${end}`, action_id: "prev_logs" });
  if (end < logs.length) actions.push({ type: "button", text: { type: "plain_text", text: "➡️ Siguiente" }, value: `${start}-${end}`, action_id: "next_logs" });

  if (actions.length > 0) blocks.push({ type: "actions", elements: actions });

  await client.chat.postEphemeral({ channel: userId, user: userId, blocks });
}

// -------------------- Manejo de botones de paginación --------------------
boltApp.action(/prev_logs|next_logs/, async ({ ack, body, action, client }) => {
  await ack();

  const userId = body.user.id;
  const [start, end] = action.value.split("-").map(Number);
  const logs = filterLogs({});
  let newStart, newEnd;

  if (action.action_id === "prev_logs") {
    newStart = Math.max(0, start - 20); // <-- Cambiado de 5 a 20
    newEnd = start;
  } else {
    newStart = end;
    newEnd = Math.min(logs.length, end + 20); // <-- Cambiado de 5 a 20
  }

  await sendLogsMessage(client, userId, logs, newStart, newEnd);
});

// -------------------- Endpoint para actualizar mensaje --------------------
app.post("/updatemessage", async (req, res) => {
  const text = req.body.text;
  const [channel, ts, ...messageParts] = text.trim().split(" ");
  const newText = messageParts.join(" ");

  if (!channel || !ts || !newText) {
    return res.json({
      response_type: "ephemeral",
      text: "❌ Formato inválido. Usa: `/updatemessage <channel_id> <ts> <nuevo texto>`",
    });
  }

  try {
    await web.chat.update({ channel, ts, text: newText });
    res.json({
      response_type: "in_channel",
      text: `✅ Mensaje actualizado correctamente en canal <#${channel}>`,
    });
  } catch (error) {
    console.error("Error al actualizar mensaje:", error.data || error.message);
    res.json({
      response_type: "ephemeral",
      text: `❌ Error al actualizar mensaje: ${error.data?.error || error.message}`,
    });
  }
});

// -------------------- Iniciar servidor --------------------
(async () => {
  await boltApp.start();
  app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
})();
