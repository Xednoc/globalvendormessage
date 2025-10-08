// index.cjs
require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');

// Inicia la app de Slack en Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN, // App-Level Token para Socket Mode
  socketMode: true,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Listener para Slash Command
app.command('/globalvendormessage', async ({ ack, body, client }) => {
  try {
    await ack(); // Obligatorio para que Slack no marque "dispatch_failed"

    // Obtener lista de canales públicos donde el bot es miembro
    const result = await client.conversations.list({
      types: 'public_channel',
      limit: 1000, // Por si hay muchos canales
    });

    const channels = result.channels
      .filter(c => c.is_member) // Solo canales donde el bot es miembro
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
            element: {
              type: 'plain_text_input',
              action_id: 'message_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Escribe tu mensaje aquí' },
            },
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
app.view('send_message_modal', async ({ ack, body, view, client }) => {
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

    // Registrar logs
    console.log(`Usuario ${body.user.name} (${body.user.id}) envió mensaje a canales: ${channelIds.join(', ')}`);
  } catch (error) {
    console.error('Error enviando mensajes:', error);
  }
});

// Express server solo para health check
const expressApp = express();

expressApp.get('/health', (req, res) => {
  res.send('OK');  // Respuesta simple para mantener el bot activo
});

expressApp.listen(10000, () => console.log('Servidor Express escuchando en puerto 10000'));

// Start Bolt app
(async () => {
  await app.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
