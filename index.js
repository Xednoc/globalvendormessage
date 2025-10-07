// =====================================
// index.js - Código maestro completo con selección dinámica de todos los canales del bot
// =====================================

import express from "express";
import fs from "fs";
import pkg from "@slack/bolt";
const { App, ExpressReceiver } = pkg;

const PORT = process.env.PORT || 10000;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN?.trim();
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET?.trim();

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  console.error("🚨 Faltan variables de entorno SLACK_BOT_TOKEN o SLACK_SIGNING_SECRET");
  process.exit(1);
}

const receiver = new ExpressReceiver({ signingSecret: SLACK_SIGNING_SECRET, endpoints: "/slack/events" });
const app = new App({ token: SLACK_BOT_TOKEN, receiver });

// -------------------- Admin --------------------
const ADMIN_USER_ID = "TU_ID_DE_USUARIO"; // reemplaza con tu ID

// -------------------- Función para guardar log solo admin --------------------
function saveLog(user, message, channels) {
  const logEntry = { timestamp: new Date().toISOString(), user, message, channels };
  fs.appendFileSync("admin_log.json", JSON.stringify(logEntry) + "\n");
}

// =====================================
// Slash command: /globalvendormessage
// =====================================
app.command("/globalvendormessage", async ({ ack, body, client, respond }) => {
  await ack();

  try {
    // Obtener todos los canales donde el bot está invitado
    const result = await client.conversations.list({ types: "public_channel,private_channel", limit: 1000 });
    const channelsOptions = result.channels.map(ch => ({
      text: { type: "plain_text", text: ch.name },
      value: ch.id,
    }));

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "global_vendor_message_modal",
        title: { type: "plain_text", text: "Mensaje Global" },
        submit: { type: "plain_text", text: "Siguiente" },
        close: { type: "plain_text", text: "Cancelar" },
        blocks: [
          {
            type: "input",
            block_id: "message_input",
            element: { type: "plain_text_input", action_id: "message", multiline: true },
            label: { type: "plain_text", text: "Mensaje" },
          },
          {
            type: "input",
            block_id: "channels_select",
            element: {
              type: "multi_static_select",
              action_id: "channels",
              placeholder: { type: "plain_text", text: "Selecciona los canales" },
              options: channelsOptions,
            },
            label: { type: "plain_text", text: "Canales destino" },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error abriendo modal:", error);
    await respond({ text: `❌ Ocurrió un error: ${error.message}`, response_type: "ephemeral" });
  }
});

// =====================================
// Primer modal: preview
// =====================================
app.view("global_vendor_message_modal", async ({ ack, body, view, client }) => {
  await ack();
  try {
    const message = view.state.values.message_input.message.value;
    const selectedChannels = view.state.values.channels_select.channels.selected_options.map(opt => opt.value);

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "global_vendor_message_confirm_modal",
        private_metadata: JSON.stringify({ message, user: body.user.id, channels: selectedChannels }),
        title: { type: "plain_text", text: "Confirma el Mensaje" },
        submit: { type: "plain_text", text: "Enviar" },
        close: { type: "plain_text", text: "Cancelar" },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📣 *Mensaje a enviar:*\n${message}\n\n*Canales seleccionados:*\n${selectedChannels.map(c => `<#${c}>`).join(", ")}`,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error mostrando preview:", error);
  }
});

// =====================================
// Modal de confirmación: enviar mensaje
// =====================================
app.view("global_vendor_message_confirm_modal", async ({ ack, body, view, client }) => {
  await ack();
  try {
    const metadata = JSON.parse(view.private_metadata);
    const message = metadata.message;
    const user = metadata.user;
    const selectedChannels = metadata.channels;

    // Guardar log solo si es admin
    if (user === ADMIN_USER_ID) saveLog(user, message, selectedChannels);

    // Enviar mensaje a los canales seleccionados
    for (const channel of selectedChannels) {
      await client.chat.postMessage({ channel, text: `📣 ${message}` });
    }

    // Confirmación efímera al usuario
    await client.chat.postEphemeral({ channel: user, user, text: `✅ Mensaje enviado a ${selectedChannels.length} canal(es).` });

    if (user === ADMIN_USER_ID) console.log("Admin ha enviado un mensaje.");

  } catch (error) {
    console.error("Error enviando mensajes desde confirmación:", error);
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
