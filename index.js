import express from "express";
import bodyParser from "body-parser";
import { App } from "@slack/bolt";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 10000;

// Inicializamos Express
const app = express();
app.use(bodyParser.json());

// Ruta para Slack Events API
app.post("/slack/events", async (req, res) => {
  const { type, challenge } = req.body;

  // Validación del challenge
  if (type === "url_verification") {
    return res.status(200).send({ challenge });
  }

  // Aquí puedes manejar otros eventos de Slack si quieres
  // Por ejemplo: message, reaction_added, etc.
  res.status(200).send();
});

// Inicializamos Slack Bolt App
const boltApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Ejemplo: escucha mensajes y responde "Hola"
boltApp.message(/.*/, async ({ message, say }) => {
  await say(`Hola <@${message.user}>!`);
});

// Start Bolt App
(async () => {
  await boltApp.start();
  console.log("Bolt App listo!");
})();

// Iniciamos servidor Express
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
