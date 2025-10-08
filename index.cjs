// index.cjs
require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN, // App-Level Token para Socket Mode
  socketMode: true,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Función para obtener todos los canales donde el bot está presente
async function getAllBotChannels(client) {
  let cursor;
  const channels = [];

  do {
    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 1000,
      cursor,
    });

    for (const c of result.channels) {
      // Solo incluir canales donde el bot está dentro (is_member = true)
      if (c.is_member) {
        channels.push({
          text: { type: 'plain_text', text: c.name },
          value: c.id,
        });
      }
    }

    cursor = result.response_metadata?.next_cursor;
  } while (cursor);

  return channels;
}

// Slash command
app.command('/globalvendormessage', async ({ ack, body, client }) => {
  await ack();

  try {
    // Obtener todos los canales donde el bot ya está dentro
    const channels = await getAllBotChannels(client);

    // Abrir modal
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'send_message_modal',
        title: { type: 'plain_text', text: 'Enviar mensaje' },
        submit: { type: 'plain_text', text: 'Enviar' },
        close: { type: 'plain_text', text: 'Cancelar' },
        blocks: [
          {
            type: 'input',
            block_id: 'message_block',
            label: { type: 'plain_text', text: 'Mensaje' },
            element: { type: 'plain_text_input', action_id: 'message_input', multiline: true },
          },
          {
            type: 'input',
            block_id: 'channels_block',
            label: { type: 'plain_text', text: 'Selecciona canales' },
            element: {
              type: 'multi_static_select',
              action_id: 'channels_select',
              placeholder: { type: 'plain_text', text: 'Canales disponibles' },
              options: channels.length
                ? channels
                : [{ text: { type: 'plain_text', text: 'No hay canales disponibles' }, value: 'none' }],
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error abriendo modal:', error);
  }
});

// Listener para el envío del modal
app.view('send_message_modal', async ({ ack, view, client }) => {
  await ack();

  try {
    const message = view.state.values['message_block']['message_input'].value;
    const selected = view.state.values['channels_block']['channels_select'].selected_options;

    if (!selected || selected.length === 0) return;

    for (const ch of selected) {
      await client.chat.postMessage({ channel: ch.value, text: message });
    }
  } catch (error) {
    console.error('Error enviando mensajes:', error);
  }
});

// Express server
const expressApp = express();
expressApp.listen(10000, () => console.log('Servidor Express escuchando en puerto 10000'));

// Start Bolt app
(async () => {
  await app.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
