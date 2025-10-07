// index.js
import pkg from '@slack/bolt';
const { App, ExpressReceiver } = pkg;

import express from 'express';
import bodyParser from 'body-parser';

// Reemplaza estos valores con tus variables de entorno
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

// ExpressReceiver para manejar eventos de Slack
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: '/slack/events' // URL que registraste en Slack
});

// Middleware para responder al challenge de verificación
receiver.app.use(bodyParser.json());
receiver.app.post('/slack/events', (req, res, next) => {
  const body = req.body;

  // Detecta la verificación de URL (challenge)
  if (body && body.type === 'url_verification') {
    console.log('Responding to Slack URL verification challenge');
    return res.status(200).send(body.challenge);
  }

  next();
});

// Inicializa la app de Slack con Bolt
const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver
});

// Aquí puedes agregar tus listeners o comandos
app.event('app_mention', async ({ event, say }) => {
  await say(`Hola <@${event.user}>! Tu bot está activo 🎉`);
});

app.command('/globalvendormessage', async ({ command, ack, respond }) => {
  await ack();
  await respond(`Recibí tu comando: ${command.text}`);
});

// Inicia el servidor
(async () => {
  const port = process.env.PORT || 10000;
  await app.start(port);
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
})();
