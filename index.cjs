const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const dotenv = require("dotenv");

dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

// Función para obtener todos los canales donde el bot está invitado
async function obtenerCanalesBot() {
  try {
    let canales = [];
    let cursor;

    do {
      const result = await web.conversations.list({
        types: "public_channel,private_channel",
        limit: 1000,
        cursor: cursor
      });

      // Filtrar solo canales donde el bot está
      const botId = (await web.auth.test()).user_id;
      const canalesConBot = result.channels.filter(ch => ch.is_member);

      canales = canales.concat(canalesConBot);
      cursor = result.response_metadata.next_cursor;

    } while (cursor);

    return canales;
  } catch (error) {
    console.error("Error obteniendo canales:", error);
    return [];
  }
}

// Función para enviar un mensaje a todos los canales del bot
async function enviarMensajeATodosCanales(texto) {
  const canales = await obtenerCanalesBot();

  for (const canal of canales) {
    try {
      await web.chat.postMessage({
        channel: canal.id,
        text: texto
      });
      console.log(`Mensaje enviado a ${canal.name}`);
    } catch (error) {
      console.error(`Error enviando mensaje a ${canal.name}:`, error);
    }
  }
}

// Ejemplo: enviar un mensaje al iniciar
(async () => {
  await app.start(process.env.PORT || 10000);
  console.log("🚀 Bot corriendo!");

  // Envía un mensaje a todos los canales al iniciar
  await enviarMensajeATodosCanales("¡Hola a todos! Este es un mensaje de prueba del bot.");
})();

// Manejo de comandos slash o eventos si los tienes
app.command("/globalvendormessage", async ({ ack, body, client }) => {
  await ack();
  try {
    // Aquí puedes abrir un modal o enviar mensaje directo
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "modal-id",
        title: { type: "plain_text", text: "Mensaje a todos los canales" },
        blocks: [
          {
            type: "input",
            block_id: "mensaje",
            label: { type: "plain_text", text: "Mensaje" },
            element: { type: "plain_text_input", action_id: "texto" }
          }
        ],
        submit: { type: "plain_text", text: "Enviar" }
      }
    });
  } catch (error) {
    console.error("Error abriendo modal:", error);
  }
});

// Escucha el submit del modal
app.view("modal-id", async ({ ack, body, view }) => {
  await ack();
  const texto = view.state.values.mensaje.texto.value;
  await enviarMensajeATodosCanales(texto);
});
