const { App } = require("@slack/bolt");

// Inicializa la app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  port: process.env.PORT || 10000,
});

// Función para obtener los canales donde el bot es miembro
async function getBotChannels(client) {
  const result = await client.conversations.list({
    types: "public_channel,private_channel",
    limit: 1000,
  });
  return result.channels.filter(c => c.is_member);
}

// Función para abrir el modal
async function openModal(trigger_id, client) {
  const canalesBot = await getBotChannels(client);

  if (canalesBot.length === 0) {
    console.log("El bot no está en ningún canal.");
    return;
  }

  const opcionesCanales = canalesBot.map(c => ({
    text: { type: "plain_text", text: c.name },
    value: c.id
  }));

  await client.views.open({
    trigger_id: trigger_id,
    view: {
      type: "modal",
      callback_id: "global_message_modal",
      title: { type: "plain_text", text: "Global Vendor Message" },
      submit: { type: "plain_text", text: "Send" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        {
          type: "input",
          block_id: "message_block",
          label: { type: "plain_text", text: "Message" },
          element: {
            type: "plain_text_input",
            action_id: "message_input",
            multiline: true
          }
        },
        {
          type: "input",
          block_id: "channels_block",
          label: { type: "plain_text", text: "Select channels" },
          element: {
            type: "multi_static_select",
            action_id: "channels_select",
            placeholder: { type: "plain_text", text: "Select channels" },
            options: opcionesCanales
          }
        }
      ]
    }
  });
}

// Evento slash command
app.command("/globalvendormessage", async ({ ack, body, client }) => {
  await ack();
  try {
    await openModal(body.trigger_id, client);
  } catch (error) {
    console.error("Error abriendo modal:", error);
  }
});

// Manejo del submit del modal
app.view("global_message_modal", async ({ ack, body, view, client }) => {
  await ack();

  const message = view.state.values.message_block.message_input.value;
  const selectedChannels = view.state.values.channels_block.channels_select.selected_options.map(o => o.value);

  // Enviar mensaje a todos los canales seleccionados
  for (const channel of selectedChannels) {
    try {
      await client.chat.postMessage({
        channel: channel,
        text: message
      });
    } catch (error) {
      console.error(`Error enviando mensaje a ${channel}:`, error);
    }
  }

  // Guardar log
  console.log({
    user: body.user.id,
    message: message,
    channels: selectedChannels
  });
});

// Arrancar la app
(async () => {
  await app.start();
  console.log("⚡ Global Vendor Message bot corriendo!");
})();
