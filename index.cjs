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

// Listener para Slash Command
app.command('/globalvendormessage', async ({ ack, body, client }) => {
  await ack(); // OBLIGATORIO para que Slack no marque "dispatch_failed"

  // Obtener lista de canales donde el bot es miembro
  let channels = [];
  try {
    const result = await client.conversations.list({ types: 'public_channel,private_channel' });
    if (result.channels && result.channels.length > 0) {
      // Filtrar solo canales donde el bot es miembro
      const botChannels = result.channels.filter(c => c.is_member);
      channels = botChannels.map(c => ({
        text: { type: 'plain_text', text: c.name },
        value: c.id,
      }));
    }
  } catch (error) {
    console.error('Error obteniendo canales:', error);
    channels = []; // fallback, modal no se rompe
  }

  // Abrir modal
  try {
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
              options: channels,
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
  await ack(); // Confirmar a Slack que recibimos el modal

  try {
    const message = view.state.values['message_block']['message_input'].value;
    const channelIds = view.state.values['channels_block']['channels_select'].selected_options.map(o => o.value);

    // Enviar mensaje a todos los canales seleccionados
    for (const channel of channelIds) {
      await client.chat.postMessage({
        channel,
        text: message,
      });
    }
  } catch (error) {
    console.error('Error enviando mensajes:', error);
  }
});

// Express server para uptime
const expressApp = express();
expressApp.get('/', (req, res) => res.send('Bot activo.'));
expressApp.listen(10000, () => console.log('Servidor Express escuchando en puerto 10000'));

// Start Bolt app
(async () => {
  await app.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
