// index.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pkg from "@slack/bolt";
const { App, ExpressReceiver } = pkg;

dotenv.config();

// Configura el receptor de Express para Slack
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Inicializa el app de Bolt
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// -------------------------
// Express propio para manejar challenge directamente
// -------------------------
const server = express();
server.use(bodyParser.json());

// Endpoint para Slack Events API
server.post("/slack/events", (req, res) => {
  const body = req.body;

  // Manejo de challenge para url_verification
  if (body.type === "url_verification") {
    console.log("Challenge recibido de Slack:", body.challenge);
    return res.status(200).send(body.challenge);
  }

  // Para otros eventos Bolt se encarga
  res.status(200).send("OK");
});

// -------------------------
// Ejemplo de un listener de eventos de Bolt
// -------------------------
app.event("app_mention", async ({ event, say }) => {
  await say(`Hola <@${event.user}>, recibí tu mensaje!`);
});

// -------------------------
// Inicia el servidor Express y el Bolt receiver
// -------------------------
const PORT = process.env.PORT || 10000;

(async () => {
  await app.start(PORT);
  server.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    console.log("Bot de Slack activo y listo para eventos.");
  });
})();
