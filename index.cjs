// index.cjs
const { App } = require('@slack/bolt');
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

// Inicializa Slack Bolt en modo Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,        // Bot Token
  appToken: process.env.SLACK_APP_TOKEN,     // App Token para Socket Mode
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true
});

// Ejemplo: listener simple de mensajes
app.message('hola', async ({ message, say }) => {
  await say(`Hola <@${message.user}>!`);
});

// Inicia Bolt
(async () => {
  await app.start();
  console.log('⚡️ Slack Bolt app corriendo en Socket Mode');
})();

// Si necesitas usar Express adicionalmente
const webApp = express();
webApp.use(bodyParser.json());

webApp.get('/', (req, res) => {
  res.send('Bot de Slack corriendo!');
});

const PORT = process.env.PORT || 3000;
webApp.listen(PORT, () => {
  console.log(`Servidor Express escuchando en puerto ${PORT}`);
});
