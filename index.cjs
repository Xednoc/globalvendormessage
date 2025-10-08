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

// Comando para abrir modal
app.command('/mensaje', async ({ ack, body, client }) => {
  await ack();

  try {
    // Lista de canales públicos y privados
    const result = await client.conversations.list({ types: 'public_channel,private_channel' });
    const publicChannels = result.channels.filter(c => !c.is_private).map(c => ({
      text: { type: 'plain_text', text: c.name },
      value: c.id
    }));
    const privateChannels = result.channels.filter(c => c.is_private).map(c => ({
      text: { type: 'plain_text', text: c.name },
      value: c.id
    }));

    // Abre modal con dos select, uno para públicos y otro para privados
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
            block_id: 'public_channels_block',
            label: { type: 'plain_text', text: 'Canales Públicos' },
            element: {
              type: 'multi_static_select',
              action_id: 'public_channels_select',
              options: publicChannels
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'private_channels_block',
            label: { type: 'plain_text', text: 'Canales Privados' },
            element: {
              type: 'multi_static_select',
              action_id: 'private_channels_select',
              options: privateChannels
            },
            optional: true
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error abriendo modal:', error);
  }
});

// Maneja el envío del modal
app.view('send_message_modal', async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const message = view.state.values.message_block.message_input.value;
  const publicChannels = view.state.values.public_channels_block?.public_channels_select?.selected_options || [];
  const privateChannels = view.state.values.private_channels_block?.private_channels_select?.selected_options || [];

  const channels = [...publicChannels, ...privateChannels].map(o => o.value);

  if (!message || channels.length === 0) {
    await client.chat.postMessage({
      channel: user,
      text: '⚠️ Debes escribir un mensaje y seleccionar al menos un canal.'
    });
    return;
  }

  const successful = [];
  const failed = [];

  for (const channel of channels) {
    try {
      await client.chat.postMessage({ channel, text: message });
      successful.push(channel);
    } catch (err) {
      console.error(`Error enviando a canal ${channel}:`, err);
      failed.push(channel);
    }
  }

  // Confirma al usuario
  let confirmation = `✅ Mensaje enviado correctamente a ${successful.length} canal(es).`;
  if (failed.length > 0) {
    confirmation += `\n⚠️ No se pudo enviar a ${failed.length} canal(es).`;
  }

  await client.chat.postMessage({ channel: user, text: confirmation });
});

(async () => {
  await app.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
