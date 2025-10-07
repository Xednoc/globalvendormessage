import { App, ExpressReceiver } from "@slack/bolt";
import express from "express";

// ==================================================
// Configuración del receiver de Express para Slack
// ==================================================
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",       // ruta que Slack usará para enviar eventos
  processBeforeResponse: true       // importante para validar la firma antes de responder
});

// ==================================================
// App de Slack
// ==================================================
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// ==================================================
// Middleware para manejar url_verification
// ==================================================
receiver.router.post("/slack/events", express.raw({ type: "*/*" }), (req, res, next) => {
  try {
    const body = JSON.parse(req.body.toString());
    if (body.type === "url_verification") {
      // Respondemos con el challenge que Slack nos envía
      return res.status(200).send(body.challenge);
    }
    next(); // si no es url_verification, pasa a Bolt
  } catch (err) {
    next(); // si falla el parseo, deja que Bolt lo maneje
  }
});

// ==================================================
// Listener de eventos ejemplo
// ==================================================
app.event("app_mention", async ({ event, say }) => {
  await say(`Hola <@${event.user}>!`);
});

// ==================================================
// Inicialización del servidor
// ==================================================
(async () => {
  const port = process.env.PORT || 10000;
  await app.start(port);
  console.log(`🚀 Slack app corriendo en puerto ${port}`);
})();
