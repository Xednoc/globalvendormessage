// index.cjs
const { App } = require('@slack/bolt');
const express = require('express');

// Inicializa la app de Slack
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Inicializa Express
const expressApp = express();

// Ruta /health para Render
expressApp.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Escucha eventos de Slack (slash commands, modals, etc.)
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack bot is running');

  // Inicia Express en el mismo puerto
  expressApp.listen(process.env.PORT || 3000, () => {
    console.log('🌐 Health endpoint active on /health');
  });
})();
