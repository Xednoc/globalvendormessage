// index.cjs
const { App } = require("@slack/bolt");

// Configuración del bot
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN, // Asegúrate de tenerlo si usas Socket Mode
});

// Función para obtener todos los canales donde el bot está invitado
async function getChannels() {
  try {
    const result = await app.client.conversations.list({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    // Filtrar solo canales donde el bot es miembro
    const botChannels = result.channels.filter((c) => c.is_member);
    return botChannels;
  } catch (error) {
    console.error("ERROR obteniendo canales:", error);
    return [];
  }
}

// Comando slash /globalvendormessage
app.command("/globalvendormessage", async ({ command, ack, client }) => {
  await ack();

  const channels = await getChannels();

  // Abrir modal
  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: "modal",
        callback_id: "global_message_modal",
        title: {
          type: "plain_text",
          text: "Global Vendor Message",
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
            block_id: "channel_block",
            element: {
              type: "static_select",
              action_id: "channel_select",
              options: channels.map((c) => ({
                text: {
                  type: "plain_text",
                  text: `#${c.name}`,
                },
                value: c.id,
              })),
            },
            label: {
              type: "plain_text",
              text: "Selecciona canal",
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "Enviar",
        },
      },
    });
  } catch (error) {
    console.error("ERROR abriendo modal:", error);
  }
});

// Listener para el submit del modal
app.view("global_message_modal", async ({ ack, view, client, body }) => {
  await ack();

  const message = view.state.values.message_block.message_input.value;
  const channelId = view.state.values.channel_block.channel_select.selected_option.value;

  try {
    await client.chat.postMessage({
      channel: channelId,
      text: message,
    });
    console.log(`Mensaje enviado a canal ${channelId}`);
  } catch (error) {
    console.error("ERROR enviando mensaje:", error);
  }
});

// Iniciar app
(async () => {
  await app.start();
  console.log("⚡ Bot corriendo");
})();
