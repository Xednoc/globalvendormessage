const express = require("express");
const bodyParser = require("body-parser");
const { WebClient } = require("@slack/web-api");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Para poder procesar JSON también

// El token ahora se lee desde la variable de entorno SLACK_BOT_TOKEN
const token = process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.error("ERROR: La variable de entorno SLACK_BOT_TOKEN no está definida.");
  process.exit(1);
}

const web = new WebClient(token);

// Aquí defines los canales donde se enviarán los mensajes
const canales = [
  "C06M1AYMSTU",
  "C06M1B1JLAW",
  "C06LLQQDT0F",
  "C06LUNGPVGE",
  "C06MQ5R42QY",
  "C06LYE9NZ53",
  "C06M1B41JJW",
  "C06MQ62H0KS",
];

// Endpoint para enviar mensaje a múltiples canales (broadcast)
app.post("/globalvendormessage", (req, res) => {
  const texto = req.body.text;
  const usuario = req.body.user_name;

  // Responder rápido a Slack para evitar timeout
  res.json({
    response_type: "ephemeral",
    text: "✅ Tu mensaje está siendo enviado a los canales...",
  });

  // Enviar mensajes asincrónicamente sin esperar (fire-and-forget)
  canales.forEach((canal) => {
    web.chat
      .postMessage({
        channel: canal,
        text: `${texto}`,
      })
      .catch((error) =>
        console.error(
          `Error al enviar a ${canal}:`,
          error.data || error.message,
        ),
      );
  });
});

// Endpoint para actualizar un mensaje ya enviado
app.post("/updatemessage", async (req, res) => {
  const channel = req.body.channel_id;  // Canal donde se ejecuta el comando
  const text = req.body.text;           // Texto que contiene el ts y el nuevo mensaje
  const user = req.body.user_name;

  // El texto debe ser: "<ts> <nuevo texto>"
  const [ts, ...messageParts] = text.trim().split(" ");
  const newText = messageParts.join(" ");

  if (!ts || !newText) {
    return res.json({
      response_type: "ephemeral",
      text: "❌ Formato inválido. Usa: `/updatemessage <ts> <nuevo texto>`",
    });
  }

  try {
    await web.chat.update({
      channel,
      ts,
      text: newText,
    });

    res.json({
      response_type: "in_channel",
      text: `✅ Mensaje actualizado por *${user}*`,
    });
  } catch (error) {
    console.error("Error al actualizar mensaje:", error.data || error.message);
    res.json({
      response_type: "ephemeral",
      text: `❌ Error al actualizar mensaje: ${error.data?.error || error.message}`,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
