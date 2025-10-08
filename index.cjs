// index.cjs

import express from "express";
import pkg from "@slack/bolt";
const { App } = pkg;

// ================================
// ⚙️ Configuración del bot de Slack
// ================================
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

// ============================================
// 🧠 Comando principal para abrir el modal
// ============================================
app.command("/globalvendormessage", async ({ ack, body, client }) => {
  await ack();

  try {
    // Obtener la lista de canales donde el bot ya es miembro
    let cursor;
    let allChannels = [];

    do {
      const result = await client.conversations.list({
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
        cursor,
      });

      const joinedChannels = result.channels.filter((ch) => ch.is_member);
      allChannels = allChannels.concat(joinedChannels);

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    // Crear opciones para el menú
    const options = allChannels.map((ch) => ({
      text: {
        type: "plain_text",
        text: ch.name,
        emoji: true,
      },
      value: ch.id,
    }));

    // Abrir el modal
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "send_message_modal",
        title: {
          type: "plain_text",
          text: "Enviar mensaje global",
          emoji: true,
        },
        submit: {
          type: "plain_text",
          text: "Enviar",
          emoji: true,
        },
        close: {
          type: "plain_text",
          text: "Cancelar",
          emoji: true,
        },
        blocks: [
          {
            type: "input",
            block_id: "channel_select_block",
            label: {
              type: "plain_text",
              text: "Selecciona los canales",
              emoji: true,
            },
            element: {
              type: "multi_static_select",
              action_id: "selected_channels",
              placeholder: {
                type: "plain_text",
                text: "Selecciona uno o varios canales",
              },
              options: options.slice(0, 100), // Slack limita a 100 opciones
            },
          },
          {
            type: "input",
            block_id: "message_input_block",
            element: {
              type: "plain_text_input",
              action_id: "message_input",
              multiline: true,
            },
            label: {
              type: "plain_text",
              text: "Escribe el mensaje",
              emoji: true,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error al abrir el modal:", error);
  }
});

// ============================================
// 📩 Acción al enviar el modal
// ============================================
app.view("send_message_modal", async ({ ack, body, view, client }) => {
  await ack();

  try {
    const selectedChannels =
      view.state.values.channel_select_block.selected_channels.selected_options.map(
        (opt) => opt.value
      );

    const message =
      view.state.values.message_input_block.message_input.value;

    // Enviar mensaje a cada canal
    for (const channelId of selectedChannels) {
      await client.chat.postMessage({
        channel: channelId,
        text: message,
      });
    }

    // Confirmar al usuario
    await client.chat.postMessage({
      channel: body.user.id,
      text: "✅ Mensaje enviado a los canales seleccionados.",
    });
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
  }
});

// ============================================
// 🚀 Servidor Express (para Render / UptimeRobot)
// ============================================
const expressApp = express();

// Endpoint para mantener vivo el bot
expressApp.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Iniciar Express en un puerto separado (necesario en Render)
const EXPRESS_PORT = process.env.EXPRESS_PORT || 10000;
expressApp.listen(EXPRESS_PORT, () => {
  console.log(`Servidor Express activo en puerto ${EXPRESS_PORT}`);
});

// Iniciar Bolt App
(async () => {
  await app.start();
  console.log("⚡ Bot de Slack en ejecución correctamente");
})();
