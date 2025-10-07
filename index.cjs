require('dotenv').config();
const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

// Listar todos los canales donde el bot está invitado
async function getBotChannels() {
  try {
    let channels = [];
    let cursor;

    do {
      const res = await web.conversations.list({
        types: 'public_channel,private_channel',
        limit: 200,
        cursor: cursor
      });

      if (res.channels) {
        // Filtrar los canales donde el bot es miembro
        const botChannels = res.channels.filter(c => c.is_member);
        channels.push(...botChannels.map(c => ({ id: c.id, name: c.name })));
      }

      cursor = res.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  } catch (error) {
    console.error('Error obteniendo canales:', error);
    return [];
  }
}

// Enviar mensaje a todos los canales donde el bot está
async function sendMessageToAllChannels(text) {
  const channels = await getBotChannels();
  for (const channel of channels) {
    try {
      await web.chat.postMessage({
        channel: channel.id,
        text: text
      });
      console.log(`Mensaje enviado a #${channel.name}`);
    } catch (error) {
      console.error(`Error enviando mensaje a #${channel.name}:`, error);
    }
  }
}

// Ejemplo de uso
app.event('app_mention', async ({ event, say }) => {
  await say(`Hola <@${event.user}>! Enviando mensaje a todos los canales...`);
  await sendMessageToAllChannels('Este es un mensaje desde Global Vendor Message Bot');
});

(async () => {
  await app.start();
  console.log('⚡️ Bot corriendo!');
})();
