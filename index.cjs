// index.cjs - Código maestro actualizado con /health y modal seguro

import { App } from '@slack/bolt';
import express from 'express';

// --------------------------------------------------------
// CONFIGURACIÓN DEL BOT
// --------------------------------------------------------
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// --------------------------------------------------------
// EXPRESS SERVER PARA /health
// --------------------------------------------------------
const expressApp = express();

expressApp.get('/health', (req, res) => {
  res.send('OK'); // Respuesta simple para UptimeRobot
});

expressApp.listen(10000, () => console.log('Servidor Express escuchando en puerto 10000'));

// --------------------------------------------------------
// HELPER: obtener canales donde el bot es miembro
// --------------------------------------------------------
async function getBotChannels(client) {
  const result = await client.conversations.list({ types: 'public_channel,private_channel', limit: 1000 });
  const channels = result.channels.filter(c => c.is_member).map(c => ({
    text: { type: 'plain_text', text: c.name },
    value: c.id,
  }));
  return channels;
}

// --------------------------------------------------------
// COMANDO /globalvendormessage
// --------------------------------------------------------
app.command('/globalvendormessage', async ({ command, ack, client, respond }) => {
  await ack();

  try {
    const channels = await getBotChannels(client);

    if (channels.length === 0) {
      await respond("El bot no está en ningún canal. Invítalo primero.");
      return;
    }

    // Modal
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'global_vendor_message',
        title: { type: 'plain_text', text: 'Global Vendor Message' },
        submit: { type: 'plain_text', text: 'Send' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'channel_select',
            label: { type: 'plain_text', text: 'Selecciona los canales' },
            element: {
              type: 'multi_static_select',
              action_id: 'selected_channels',
              options: channels,
              initial_option: channels[0] // inicializamos con el primer canal seguro
            }
          },
          {
            type: 'input',
            block_id: 'message_input',
            label: { type: 'plain_text', text: 'Escribe tu mensaje' },
            element: {
              type: 'plain_text_input',
              multiline: true,
              action_id: 'message'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error("Error abriendo modal:", error);
    await respond(`Ocurrió un error: ${error.data?.error || error.message}`);
  }
});

// --------------------------------------------------------
// LISTENER PARA ENVIAR MENSAJE
// --------------------------------------------------------
app.view('global_vendor_message', async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const selectedChannels = view.state.values.channel_select.selected_channels.selected_options.map(opt => opt.value);
  const message = view.state.values.message_input.message.value;

  // Registrar log
  console.log(`[LOG] Usuario ${user} envió mensaje a canales: ${selectedChannels.join(', ')}`);

  // Enviar mensaje a los canales
  for (const channelId of selectedChannels) {
    try {
      await client.chat.postMessage({
        channel: channelId,
        text: message
      });
    } catch (err) {
      console.error(`Error enviando mensaje a ${channelId}:`, err);
    }
  }
});

// --------------------------------------------------------
// START BOT
// --------------------------------------------------------
(async () => {
  await app.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();
