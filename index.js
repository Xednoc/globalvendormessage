// =====================================
// index.js - Código maestro estable
// =====================================

import express from "express";
import pkg from "@slack/bolt";
const { App, ExpressReceiver } = pkg;

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
// Configuración de Express y Bolt
// =====================================
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",
});

const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// =====================================
// Lista de canales disponibles (fijos)
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
// Función para guardar log
// =====================================
function saveLog(user, message, channels) {
  const logEntry = {
    user,
    message,
    channels,
    timestamp: new Date().toISOString(),
  };
  console.log("LOG Broadcast:", logEntry);
}

// =====================================
// Slash command: /globalvendormessage
// =====================================
app.command("/globalvendormessage", async ({ command, ack, client, respond }) => {
  try {
    await ack();
    console.log("DEBUG: Comando recibido:", command);

    const modal = {
      type: "modal",
      callback_id: "broadcast_modal",
      title: {
        type: "plain_text",
        text: "Global Vendor Message",
      },
      submit: {
        type: "plain_text",
        text: "Send",
      },
      close: {
        type: "plain_text",
        text: "Cancel",
      },
      blocks: [
        {
          type: "input",
          block_id: "message_block",
          element: {
            type: "plain_text_input",
            multiline: true,
            action_id: "message_input",
          },
          label: {
            type: "plain_text",
            text: "Mensaje",
          },
        },
        {
          type: "input",
          block_id: "channels_block",
          element: {
            type: "multi_static_select",
            placeholder: {
              type: "plain_text",
              text: "Selecciona los canales",
            },
            options: canales.map((c) => ({
              text: { type: "plain_text", text: c.label },
              value: c.value,
            })),
            action_id: "channels_select",
          },
          label: {
            type: "plain_text",
            text: "Canales destino",
          },
        },
      ],
    };

    await client.views.open({
      trigger_id: command.trigger_id,
      view: modal,
    });
  } catch (error) {
    console.error("ERROR abriendo modal:", error);
    await respond({
      text: `❌ Ocurrió un error: ${error.message}`,
      response_type: "ephemeral",
    });
  }
});

// =====================================
// Middleware para verificar requests de Slack
// =====================================
receiver.app.use(express.json());
receiver.app.use((req, res, next) => {
  // Bolt ya maneja verification del signature
  next();
});

// =====================================
// Iniciando servidor
// =====================================
(async () => {
  try {
    await app.start(PORT);
    console.log("=======================================");
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    console.log(`🌐 URL pública: ${process.env.PUBLIC_URL || "https://globalvendormessage.onrender.com"}`);
    console.log("=======================================");
  } catch (error) {
    console.error("🚨 ERROR iniciando la app:", error);
    process.exit(1);
  }
})();
