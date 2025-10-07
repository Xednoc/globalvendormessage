// =====================================
// index.js - Código maestro completo
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
// Lista de canales disponibles (dinámica si quieres luego)
// =====================================
let canalesDisponibles = []; // Se llenará con los canales donde el bot está invitado

// =====================================
// Middleware para obtener canales al iniciar
// =====================================
async function fetchBotChannels() {
  try {
    const result = await app.client.conversations.list({
      token: SLACK_BOT_TOKEN,
      types: "public_channel,private_channel",
    });
    canalesDisponibles = result.channels.filter(c => c.is_member).map(c => ({
      label: c.name,
      value: c.id,
    }));
    console.log("DEBUG: Canales disponibles para el bot:", canalesDisponibles);
  } catch (err) {
    console.error("ERROR obteniendo canales del bot:", err);
  }
}
fetchBotChannels();

// =====================================
// Función para guardar logs
// =====================================
function saveLog(user, message, channels) {
  console.log(`LOG BROADCAST: ${user} -> ${message} (Canales: ${channels.map(c => c.label).join(", ")})`);
}

// =====================================
// Slash command: /globalvendormessage
// =====================================
app.command("/globalvendormessage", async ({ command, ack, client }) => {
  await ack();

  try {
    // Abrir modal
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: "modal",
        callback_id: "broadcast_modal",
        title: { type: "plain_text", text: "Global Vendor Message" },
        submit: { type: "plain_text", text: "Enviar" },
        close: { type: "plain_text", text: "Cancelar" },
        blocks: [
          {
            type: "input",
            block_id: "message_block",
            label: { type: "plain_text", text: "Mensaje" },
            element: { type: "plain_text_input", action_id: "message_input", multiline: true }
          },
          {
            type: "input",
            block_id: "channels_block",
            label: { type: "plain_text", text: "Canales destino" },
            element: {
              type: "multi_static_select",
              action_id: "channels_input",
              options: canalesDisponibles.map(c => ({
                text: { type: "plain_text", text: c.label },
                value: c.value
              }))
            }
          }
        ]
      }
    });
  } catch (err) {
    console.error("ERROR abriendo modal:", err);
  }
});

// =====================================
// Manejo de envío desde modal
// =====================================
app.view("broadcast_modal", async ({ ack, body, view, client }) => {
  await ack(); // ACK inmediato para Slack

  try {
    const user = body.user.id;
    const mensaje = view.state.values.message_block.message_input.value;
    const canalesSeleccionados = view.state.values.channels_block.channels_input.selected_options;

    // Guardar log
    saveLog(user, mensaje, canalesSeleccionados);

    // Enviar mensaje a todos los canales seleccionados
    for (const c of canalesSeleccionados) {
      await client.chat.postMessage({
        channel: c.value,
        text: mensaje,
      });
    }

  } catch (err) {
    console.error("ERROR enviando broadcast:", err);
  }
});

// =====================================
// Middleware para verificar requests de Slack
// =====================================
receiver.app.use(express.json());
receiver.app.use((req, res, next) => {
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
