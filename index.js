import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware para leer JSON
app.use(express.json());

// Endpoint de Slack Events
app.post("/slack/events", (req, res) => {
  const { type, challenge } = req.body;

  if (type === "url_verification") {
    // Respondemos exactamente con el challenge
    return res.status(200).send(challenge);
  }

  // Aquí van tus otros eventos del bot, por ejemplo:
  console.log("Evento recibido de Slack:", req.body);
  res.status(200).send(); // siempre responder 200 a Slack
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
