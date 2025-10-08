// ============================
// 📦 DEPENDENCIAS
// ============================
const { App } = require("@slack/bolt");
const express = require("express");

// ============================
// ⚙️ CONFIGURACIÓN PRINCIPAL
// ============================
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

// ============================
// ⚡️ EVENTOS Y ACCIONES
// ============================

// Comando que abre el modal
app.command("/globalvendormessage", async ({ ack, body, client }) => {
  await ack();

  try {
    // Obtener todos los canales a los que el bot pertenece
    let channels = [];
    let cursor;

    do {
      const response = await client.conversations.list({
        limit: 1000,
        cursor: cursor,
        types: "public_channel,private_channel"
      });

      // Filtrar solo canales donde el bot ya es miembro
      const filtered = response.channels.filter(c => c.is_member);
      channels = channels.concat(filtered);
      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    // Crear opciones para el menú
    const options = channels.map(ch => ({
      text: { type: "plain_text", text: `#${ch.name}` },
      value: ch.id
    }));

    // Mostrar modal
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "send_message_modal",
        title: { type: "plain_text", text: "Enviar mensaje global" },
        submit: { type: "plain_text", text: "Enviar" },
        close: { type: "plain_text", text: "Cancelar" },
        blocks: [
          {
            type: "input",
            block_id: "channel_select",
            label: { type: "plain_text", text: "Selecciona los canales" },
            element: {
              type: "multi_static_select",
              action_id: "selected_channels",
              placeholder: { type: "plain_text", text: "Selecciona uno o varios canales" },
              options: options
            }
          },
          {
            type: "input",
            block_id: "message_input",
            label: { type: "plain_text", text: "Mensaje" },
            element: {
              type: "plain_text_input",
              action_id: "message_value",
              multiline: true,
              placeholder: { type: "plain_text", text: "Escribe tu mensaje aquí..." }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error("❌ Error al abrir el modal:", error);
  }
});

// Acción del modal
app.view("send_message_modal", async ({ ack, body, view, client }) => {
  await ack();

  const selectedChannels = view.state.values.channel_select.selected_channels.selected_options.map(opt => opt.value);
  const message = view.state.values.message_input.message_value.value;

  for (const channel of selectedChannels) {
    try {
      await client.chat.postMessage({
        channel: channel,
        text: message
      });
    } catch (error) {
      console.error(`❌ Error al enviar mensaje a ${channel}:`, error);
    }
  }
});

// ============================
// 🌐 EXPRESS SERVER PARA HEALTH
// ============================
const expressApp = ex
