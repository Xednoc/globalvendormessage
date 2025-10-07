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

// ID del admin (tú)
const ADMIN_ID = "TU_USER_ID_AQUI";

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
// Lista de canales donde está invitado el bot
// =====================================
let canalesDisponibles = [];

async function fetchBotChannels() {
  try {
    const result = await app.client.conversations.list({
      token: SLACK_BOT_TOKEN,
      types: "public_channel,private_channel",
    });
    canalesDisponibles = result.channels
      .filter(c => c.is_member)
      .map(c => ({
        label: c.name,
        value: c.id,
      }));

    console.log("DEBUG: Canales disponibles para el bot:", canalesDisponibles);
  } catch (err) {
    console.error("ERROR obteniendo canales del bot:", err);
    canalesDisponibles = [];
  }
}

// =====================================
// Función para guardar log de broadcasts
// =====================================
function saveLog(user, message, channels) {
  const logEntry = {
    user,
    message,
    channels,
    timestamp: new Date().toISOString(),
  };
  console.log("LOG BROADCAST:", logEntry);
}

// =====================================
// Slash command: /globalvendormessage
// =====================================
app.command("/globalvendormessage", async ({ command, ack, client }) => {
  await ack();

  try {
    // Obtener canales actualizados antes de abrir modal
    await fetchBotChannels();

    // Si no hay canales disponibles
    if (canalesDisponibles.length === 0) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "❌ No hay canales disponibles donde el bot esté invitado.",
      });
      return;
    }

    // Modal con selección de canales y mensaje
    const modal = {
      type: "modal",
      callback_id: "globalvendormessage_modal", // <-- Esto es clave
      title: { type: "plain_text", text: "Mensaje Global" },
      blocks: [
        {
          type: "input",
          block_id: "canales_block",
          element: {
            type: "multi_static_select",
            action_id: "canales_action",
            placeholder: { type: "plain_text", text: "Selecciona canales" },
            options: canalesDisponibles.map(c => ({
              text: { type: "plain_text", text: c.label },
              value: c.value,
            })),
          },
          label: { type: "plain_text", text: "Canales destino" },
        },
        {
          type: "input",
          block_id: "mensaje_block",
          element: {
            type: "plain_text_input",
            action_id: "mensaje_action",
            multiline: true,
          },
          label: { type: "plain_text", text: "Mensaje" },
        },
      ],
      submit: { type: "plain_text", text: "Enviar" },
    };

    await client.views.open({
      trigger_id: command.trigger_id,
      view: modal,
    });
  } catch (err) {
    console.error("ERROR abriendo modal:", err);
  }
});

// =====================================
// Manejo de submit del modal
// =====================================
app.view("globalvendormessage_modal", async ({ ack, body, view, client }) => {
  await ack();

  try {
    const user = body.user.id;
    const message = view.state.values.mensaje_block.mensaje_action.value;
    const selectedChannels = view.state.values.canales_block.canales_action.selected_options.map(
      o => o.value
    );

    // Enviar mensaje a todos los canales seleccionados
    for (const channel of selectedChannels) {
      await client.chat.postMessage({
        channel,
        text: message,
      });
    }

    // Guardar log
    saveLog(user, message, selectedChannels);

    // Notificación de envío
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: `✅ Mensaje enviado a ${selectedChannels.length} canal(es).`,
    });
  } catch (err) {
    console.error("ERROR enviando broadcast:", err);
  }
});

// =====================================
// Middleware
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
