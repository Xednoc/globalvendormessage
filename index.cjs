// ===============================
// 🧠 GLOBAL VENDOR MESSAGE BOT
// ===============================

const { App } = require('@slack/bolt');
const express = require('express');

// -------------------------------
// ⚙️ Configuración de Slack (SOCKET MODE)
// -------------------------------
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

// -------------------------------
// 💬 Comando principal: /globalvendormessage
// -------------------------------
app.command('/globalvendormessage', async ({ ack, body, client }) => {
  await ack();

  try {
    // Abre el modal cuando se ejecuta el comando
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'vendor_message_modal',
        title: { type: 'plain_text', text: 'Global Vendor Message' },
        submit: { type: 'plain_text', text: 'Send' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'message_input',
            label: { type: 'plain_text', text: 'Message to send to all channels:' },
            element: {
              type: 'plain_text_input',
              action_id: 'message',
              multiline: true
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('❌ Error opening modal:', error);
  }
});

// -------------------------------
// 📤 Envío del mensaje a todos los canales
// -------------------------------
app.view('vendor_message_modal', async ({ ack, view, client }) => {
  await ack();

  const message = view.state.values.message_input.message.value;

  try {
    // Paginar y enviar solo a canales donde el bot esté presente
    let cursor;
    do {
      const response = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
        cursor
      });

      const joinedChannels = response.channels.filter(ch => ch.is_member);
      for (const channel of joinedChannels) {
        try {
          await client.chat.postMessage({
            channel: channel.id,
            text: message
          });
        } catch (err) {
          console.error(`❌ Error sending message to ${channel.name}:`, err.data?.error || err);
        }
      }

      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    console.log('✅ Message sent to all joined channels');
  } catch (error) {
    console.error('❌ Error listing or sending messages:', error);
  }
});

// -------------------------------
// 🩺 Endpoint /health (Render Uptime)
// -------------------------------
const expressApp = express();

expressApp.get('/health', (req, res) => {
  res.status(200).send('OK');
});

expressApp.listen(10000, () => {
  console.log('🌐 Health endpoint activo en /health');
});

// -------------------------------
// 🚀 Inicio del bot
// -------------------------------
(async () => {
  await app.start();
  console.log('⚡️ Slack bot corriendo correctamente');
})();
