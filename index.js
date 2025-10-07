// =====================================
// IMPORTS
// =====================================
import { App, ExpressReceiver } from "@slack/bolt";

// =====================================
// VARIABLES DE ENTORNO
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
// EXPRESS RECEIVER
// =====================================
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: "/slack/events", // ⚠️ la URL debe coincidir con Slack
});

// =====================================
// SLACK APP
// =====================================
const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// =====================================
// COMANDO /globalvendormessage
// =====================================
app.command("/globalvendormessage", async ({ ack, body, client }) => {
  try {
    await ack(); // responde inmediatamente para evitar timeout

    // ejemplo: abrir un modal simple
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "global_message_modal",
        title: {
          type: "plain_text",
          text: "Global Message"
        },
        blocks: [
          {
            type: "input",
            block_id: "message_block",
            element: {
              type: "plain_text_input",
              action_id: "message_input",
              multiline: true,
            },
            label: {
              type: "plain_text",
              text: "Escribe el mensaje para los vendors"
            }
          }
        ],
        submit: {
          type: "plain_text",
          text: "Enviar"
        }
      }
    });
  } catch (error) {
    console.error("Error en /globalvendormessage:", error);
  }
});

// =====================================
// LISTENER DE SUBMISSION DEL MODAL
// =====================================
app.view("global_message_modal", async ({ ack, body, view, client }) => {
  await ack();
  const user = body.user.id;
  const message = view.state.values.message_block.message_input.value;

  try {
    // Enviar mensaje a un canal de ejemplo (#general)
    await client.chat.postMessage({
      channel: "#general",
      text: `*Mensaje global de <@${user}>:*\n${message}`
    });
    console.log("Mensaje enviado:", message);
  } catch (err) {
    console.error("Error enviando mensaje:", err);
  }
});

// =====================================
// INICIAR APP
// =====================================
(async () => {
  await app.start(PORT);
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
})();
