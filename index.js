// =====================================
// index.js - Código maestro completo con admin único y comando abierto a todos
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
// Configuración admin y canales fijos
// =====================================
const ADMIN_USER_ID = "TU_ID_DE_USUARIO"; // reemplaza con tu ID
const FIXED_CHANNELS = ["CANAL_ID_1", "CANAL_ID_2", "CANAL_ID_3"]; // reemplaza con tus canales

// =====================================
// Slash command: /globalvendormessage (todos pueden usar)
// =====================================
app.command("/globalvendormessage", async ({ ack, body, client, respond }) => {
  await ack();

  try {
    // Abrir modal para escribir mensaje
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
              placeholder: {
                type: "plain_text",
                text: "Escribe el mensaje que quieres enviar...",
              },
            },
            label: { type: "plain_text", text: "Mensaje" },
          },
          {
            type: "section",
            block_id: "channels_display",
            text: {
              type: "mrkdwn",
              text: `📌 *Canales destino (fijos)*:\n${FIXED_CHANNELS.map(c => `<#${c}>`).join(", ")}`,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error abriendo modal:", error);
    await respond({
      text: `❌ Ocurrió un error: ${error.message}`,
      response_type: "ephemeral",
    });
  }
});

// =====================================
// Primer modal: preview de mensaje
// =====================================
app.view("global_vendor_message_modal", async ({ ack, body, view, client }) => {
  await ack();

  try {
    const message = view.state.values.message_input.message.value;

    // Abrir modal de confirmación con preview
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "global_vendor_message_confirm_modal",
        private_metadata: JSON.stringify({ message, user: body.user.id }),
        title: { type: "plain_text", text: "Confirma el Mensaje" },
        submit: { type: "plain_text", text: "Enviar" },
        close: { type: "plain_text", text: "Cancelar" },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📣 *Mensaje a enviar:*\n${message}\n\n*Canales destino:*\n${FIXED_CHANNELS.map(c => `<#${c}>`).join(", ")}`,
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
    const timestamp = new Date().toISOString();

    // Log completo
    console.log("=======================================");
    console.log(`USUARIO: ${user}`);
    console.log(`FECHA: ${timestamp}`);
    console.log(`MENSAJE: ${message}`);
    console.log(`CANALES: ${FIXED_CHANNELS.join(", ")}`);
    console.log("=======================================");

    // Enviar mensaje a todos los canales fijos
    for (const channel of FIXED_CHANNELS) {
      await client.chat.postMessage({
        channel: channel,
        text: `📣 ${message}`,
      });
    }

    // Confirmación efímera al usuario
    await client.chat.postEphemeral({
      channel: user,
      user: user,
      text: `✅ Mensaje enviado a ${FIXED_CHANNELS.length} canal(es).`,
    });

    // Aquí podrías usar tu ID de admin en el futuro para control extra si quisieras
    if (user === ADMIN_USER_ID) {
      console.log("Admin ha enviado un mensaje.");
    }
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
