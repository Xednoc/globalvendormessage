// =====================================
// index.js - Código maestro completo
// =====================================

import express from "express";
import pkg from "@slack/bolt";
const { App, ExpressReceiver } = pkg;

// =====================================
// Variables de entorno
// =====================================
const PORT = process.env.PORT || 10000;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN?.trim();
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET?.trim();

console.log("=======================================");
console.log("DEBUG: Verificando variables de entorno");
console.log("SLACK_BOT_TOKEN =", SLACK_BOT_TOKEN ? "✅ OK" : "❌ MISSING");
console.log("SLACK_SIGNING_SECRET =", SLACK_SIGNING_SECRET ? "✅ OK" : "❌ MISSING");
if (SLACK_SIGNING_SECRET) console.log("Longitud del secret:", SLACK_SIGNING_SECRET.length);
console.log("=======================================");

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  console.error("🚨 ERROR: Faltan variables de entorno SLACK_BOT_TOKEN o SLACK_SIGNING_SECRET");
  process.exit(1);
}

// =====================================
// Configuración de Express y Bolt
// =====================================
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: "/slack/events", // coincidente con el Request URL del slash command
});

const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// =====================================
// Slash command: /globalvendormessage
// =====================================
app.command("/globalvendormessage", async ({ command, ack, respond }) => {
  try {
    await ack();
    console.log("DEBUG: Comando recibido:", command);

    const message = command.text || "Mensaje global a vendors";
    await respond({
      text: `📣 Enviando mensaje a todos los vendors: ${message}`,
      response_type: "ephemeral",
    });

    // Aquí puedes agregar la lógica para enviar mensajes a canales específicos
    // o hacer un broadcast según lo que necesites.

  } catch (error) {
    console.error("ERROR manejando comando /globalvendormessage:", error);
    await respond({
      text: `❌ Ocurrió un error: ${error.message}`,
      response_type: "ephemeral",
    });
  }
});

// =====================================
// Middleware para verificar requests de Slack
// =====================================
receiver.app.use(express.json());
receiver.app.use((req, res, next) => {
  // Bolt ya maneja verification del signature
  next();
});

// =====================================
// Iniciando servidor
// =====================================
(async () => {
  try {
    await app.start(PORT);
    console.log("=======================================");
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    console.log(`🌐 URL pública: ${process.env.PUBLIC_URL || "https://globalvendormessage.onrender.com"}`);
    console.log("=======================================");
  } catch (error) {
    console.error("🚨 ERROR iniciando la app:", error);
    process.exit(1);
  }
})();
