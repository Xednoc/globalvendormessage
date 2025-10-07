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
// Slash command: /globalvendormessage con modal y preview
// =====================================
app.command("/globalvendormessage", async ({ ack, body, client }) => {
  await ack();

  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "global_vendor_message_modal",
        title: { type: "plain_text", text: "Mensaje Global" },
        submit: { type: "plain_text", text: "Enviar" },
        close: { type: "plain_text", text: "Cancelar" },
        blocks: [
          {
            type: "input",
            block_id: "message_input",
            element: {
              type: "plain_text_input",
              action_id: "message",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Escribe el mensaje que quieres enviar...",
              },
            },
            label: { type: "plain_text", text: "Mensaje" },
          },
          {
            type: "input",
            block_id: "channels_input",
            element: {
              type: "multi_channels_select",
              action_id: "channels",
              placeholder: { type: "plain_text", text: "Selecciona los canales destino" },
            },
            label: { type: "plain_text", text: "Canales" },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error abriendo modal:", error);
  }
});

// =====================================
// Acción al enviar el modal con preview
// =====================================
app.view("global_vendor_message_modal", async ({ ack, body, view, client }) => {
  await ack();

  try {
    const message = view.state.values.message_input.message.value;
    const channels = view.state.values.channels_input.channels.selected_channels;
    const user = body.user.id;
    const timestamp = new Date().toISOString();

    // Log de quién envía el mensaje
    console.log("=======================================");
    console.log(`USUARIO: ${user}`);
    console.log(`FECHA: ${timestamp}`);
    console.log(`MENSAJE: ${message}`);
    console.log(`CANALES: ${channels.join(", ")}`);
    console.log("=======================================");

    // Preview efímero al usuario antes de enviar
    await client.chat.postEphemeral({
      channel: user,
      user: user,
      text: `📣 *Preview del mensaje* que se enviará a ${channels.length} canal(es):\n\n${message}`,
    });

    // Enviar mensaje a todos los canales seleccionados
    for (const channel of channels) {
      await client.chat.postMessage({
        channel: channel,
        text: `📣 ${message}`,
      });
    }

    // Confirmación al usuario
    await client.chat.postEphemeral({
      channel: user,
      user: user,
      text: `✅ Mensaje enviado a ${channels.length} canal(es).`,
    });
  } catch (error) {
    console.error("Error enviando mensajes:", error);
  }
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
