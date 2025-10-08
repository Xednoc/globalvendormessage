require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');

// Inicializa el app de Slack en Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Express para que Render mantenga vivo el servicio
const server = express();
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Servidor Express escuchando en puerto ${PORT}`));

// Abre un modal cuando se escribe el comando /mensaje
app.command('/mensaje', async ({ ack, body, client }) => {
  await ack();

  // Obtiene lista de canales públicos
  const result = await client.conversations.list({ types: 'public_channel,private_channel' });
  const channelsOptions = result.channels.map(c => ({
    text: { type: 'plain_text', text: c.name },
    value: c.id
  }));

  // Abre el modal
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'send_message_modal',
      title: { type: 'plain_text', text: 'Enviar Mensaje' },
      submit: { type: 'plain_text', text: 'Enviar' },
      close: { type: 'plain_text', text: 'Cancelar' },
      blocks: [
        {
          type: 'input',
          block_id: 'message_block',
          label: { type: 'plain_text', text: 'Mensaje' },
          element: { type: 'plain_text_input', action_id: 'message_input', multiline: true }
        },
        {
          type: 'input',
          block_id: 'channels_block',
          label: { type: 'plain_text', text: 'Selecciona canales' },
          element: {
            type: 'multi_static_select',
            action_id: 'channels_select',
            options: channelsOptions
          }
        }
      ]
    }
  });
});

// Maneja el envío del modal
app.view('send_message_modal', async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const message = view.state.values.message_block.message_input.value;
  const channels = view.state.values.channels_block.channels_select.selected_options.map(o => o.value);

  // Envía el mensaje a los canales seleccionados
  for (const channel of channels) {
    await client.chat.postMessage({ channel, text: message });
  }

  // Confirma al usuario que se envió el mensaje
  await client.chat.postMessage({ channel: user, text: `✅ Mensaje enviado a ${channels.length} canales.` });
});

(async () => {
  await app.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
