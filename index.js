// =====================================
// index.js - Código maestro completo con selección dinámica de canales y log solo admin
// =====================================

import express from "express";
import fs from "fs";
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
// Configuración admin y lista de canales posibles
// =====================================
const ADMIN_USER_ID = "TU_ID_DE_USUARIO"; // reemplaza con tu ID
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
    timestamp: new Date().toISOString(),
    user,
    message,
    channels,
  };
  fs.appendFileSync("admin_log.json", JSON.stringify(logEntry) + "\n");
}

// =====================================
// Slash command: /globalvendormessage (todos pueden usar)
// =====================================
app.command("/globalvendormessage", async ({ ack, body, client, respond }) => {
  await ack();

  try {
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
            element: {
              type: "plain_text_input",
              action_id: "message",
              multiline: true,
              placeholder: { type: "plain_text", text: "Escribe tu mensaje..." },
            },
            label: { type: "plain_text", text: "Mensaje" },
          },
          {
            type: "input",
            block_id: "channels_select",
            element: {
              type: "multi_static_select",
              action_id: "channels",
              placeholder: { type: "plain_text", text: "Selecciona los canales" },
              options: canales.map(ch => ({
                text: { type: "plain_text", text: ch.label },
                value: ch.value,
              })),
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
// Primer modal: preview de mensaje
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
        private_metadata: JSON.stringify({
          message,
          user: body.user.id,
          channels: selectedChannels,
        }),
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
// Modal de confirmación: envío de mensaje
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
    await client.chat.postEphemeral({
      channel: user,
      user,
      text: `✅ Mensaje enviado a ${selectedChannels.length} canal(es).`,
    });

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
