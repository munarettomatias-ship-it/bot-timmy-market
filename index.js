const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;
const MAYORISTA_NUMBER = "543757574452";
const AGENT_NUMBER = process.env.AGENT_NUMBER;

const sessions = {};

function detectLang(text) {
  const pt = /ol|oi|bom dia|boa tarde|boa noite|tudo bem|obrigado|atacado|preco/i;
  return pt.test(text) ? "pt" : "es";
}

function getBRLRate() {
  const rate = process.env.BRL_RATE || "275";
  return "Cambio del dia: $" + rate + " pesos argentinos = 1 Real";
}

async function sendMsg(phone, text) {
  await axios.post(
    EVOLUTION_URL + "/message/sendText/" + INSTANCE,
    { number: phone, text },
    { headers: { apikey: EVOLUTION_KEY } }
  );
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (!body || !body.data || !body.data.key || body.data.key.fromMe) return;

    const phone = body.data.key.remoteJid.replace("@s.whatsapp.net", "");
    const text = (body.data.message && body.data.message.conversation) ||
                 (body.data.message && body.data.message.extendedTextMessage && body.data.message.extendedTextMessage.text) || "";

    if (!text) return;

    if (!sessions[phone]) {
      sessions[phone] = { step: "getName", lang: detectLang(text), waitingAgent: false };
    }

    const session = sessions[phone];
    if (session.waitingAgent) return;

    if (/agente|humano|persona|asesor/i.test(text)) {
      session.waitingAgent = true;
      const msg = session.lang === "pt" ? "Vou te conectar com um atendente!" : "Te conecto con un agente!";
      await sendMsg(phone, msg);
      await sendMsg(AGENT_NUMBER, "Cliente necesita atencion:\nNumero: +" + phone + "\nNombre: " + (session.name || "desconocido"));
      return;
    }

    if (/mayorista|atacado|por mayor/i.test(text)) {
      const msg = session.lang === "pt"
        ? "Para atacado contacte: wa.me/" + MAYORISTA_NUMBER
        : "Para mayoristas contacta: wa.me/" + MAYORISTA_NUMBER;
      await sendMsg(phone, msg);
      return;
    }

    if (session.step === "getName") {
      session.lang = detectLang(text);
      if (/^(hola|hi|oi|buen|buenas|hey)/i.test(text)) {
        const msg = session.lang === "pt"
          ? "Ola! Bem-vindo ao Mercado Timmy!\nQual e o seu nome?"
          : "Hola! Bienvenido al Mercado Timmy!\nCual es tu nombre?";
        await sendMsg(phone, msg);
        return;
      }
      session.name = text.trim().split(" ")[0];
      session.step = "menu";
      let msg = session.lang === "pt"
        ? "Prazer, " + session.name + "!\n"
        : "Mucho gusto, " + session.name + "!\n";
      if (session.lang === "pt") {
        msg += "\n" + getBRLRate() + "\n";
      }
      msg += session.lang === "pt"
        ? "\nComo posso ajudar?\n1 - Ofertas da semana\n2 - Precos e produtos\n3 - Falar com atendente"
        : "\nEn que te ayudo?\n1 - Ofertas de la semana\n2 - Precios y productos\n3 - Hablar con un agente";
      await sendMsg(phone, msg);
      return;
    }

    if (session.step === "menu") {
      if (text === "1") {
        await sendMsg(phone, "Ofertas de la semana:\n- Arroz 5kg: $2.500\n- Aceite 1.5L: $1.800\n- Yerba 1kg: $3.200\nValido hasta el domingo!");
      } else if (text === "2") {
        const msg = session.lang === "pt"
          ? "Diga o nome do produto para consultar preco."
          : "Decime el producto y te doy el precio.";
        await sendMsg(phone, msg);
      } else if (text === "3") {
        session.waitingAgent = true;
        await sendMsg(phone, "Conectando con agente...");
        await sendMsg(AGENT_NUMBER, session.name + " quiere hablar con un agente.\nNumero: +" + phone);
      } else {
        const msg = session.lang === "pt" ? "Escolha: 1, 2 ou 3" : "Elegi una opcion: 1, 2 o 3";
        await sendMsg(phone, msg);
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
});

app.get("/", (_, res) => res.json({ status: "Bot Timmy Market OK" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log("Bot corriendo en puerto " + PORT); });
