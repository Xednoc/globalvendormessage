// index.cjs
require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');

// ========================
// SLACK APP (Socket Mode)
// ========================
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// ========================
// SLASH COMMAND LISTENER
// ========================
slackApp.command('/globalvendormessage', async ({ ack, body, client }) => {
  await ack();

  try {
    const result = await client.conversations.list({ types: 'public_channel' });

    const channels = result.channels
      .filter(c => c.is_member)
      .map(c => ({
        text: { type: 'plain_text', text: c.name },
        value: c.id,
      }));

    if (channels.length === 0) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '⚠️ No hay canales disponibles donde el bot sea miembro.',
      });
      return;
    }

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

// ========================
// MODAL SUBMIT LISTENER
// ========================
slackApp.view('send_message_modal', async ({ ack, body, view, client }) => {
  await ack();

  try {
    const message = view.state.values['message_block']['message_input'].value;
    const channelIds = view.state.values['channels_block']['channels_select'].selected_options.map(o => o.value);

    for (const channel of channelIds) {
      await client.chat.postMessage({
        channel,
        text: message,
      });
    }

    // Log del uso
    console.log(`[LOG] Usuario: ${body.user.name} (${body.user.id}) envió mensaje a canales: ${channelIds.join(', ')}`);
  } catch (error) {
    console.error('Error enviando mensajes:', error);
  }
});

// ========================
// EXPRESS SERVER
// ========================
const expressApp = express();

// Endpoint de monitoreo para UptimeRobot
expressApp.get('/health', (req, res) => {
  res.send('OK');
});

expressApp.listen(10000, () => console.log('Servidor Express escuchando en puerto 10000'));

// ========================
// INICIAR SLACK APP
// ========================
(async () => {
  await slackApp.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
