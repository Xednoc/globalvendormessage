// index.cjs
require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');

// Inicialización de Slack Bolt con Socket Mode
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN, // App-Level Token para Socket Mode
  socketMode: true,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Listener para Slash Command
slackApp.command('/globalvendormessage', async ({ ack, body, client }) => {
  try {
    await ack(); // OBLIGATORIO para evitar "dispatch_failed"

    // Obtener lista de canales públicos donde el bot es miembro
    const result = await client.conversations.list({ types: 'public_channel' });
    const channels = result.channels
      .filter(c => c.is_member) // SOLO los canales donde el bot pertenece
      .map(c => ({
        text: { type: 'plain_text', text: c.name },
        value: c.id,
      }));

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
slackApp.view('send_message_modal', async ({ ack, view, client }) => {
  await ack(); // Confirmar recepción del modal

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

    // Guardar log del usuario y mensaje
    console.log(`Usuario envió mensaje a ${channelIds.length} canales: ${message}`);
  } catch (error) {
    console.error('Error enviando mensajes:', error);
  }
});

// EXPRESS SERVER
const expressApp = express();

// ENDPOINT PARA MONITOREO (UptimeRobot)
expressApp.get('/health', (req, res) => {
  res.send('OK'); // Respuesta simple para mantener el bot activo
});

expressApp.listen(10000, () => console.log('Servidor Express escuchando en puerto 10000'));

// START BOLT APP
(async () => {
  await slackApp.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
