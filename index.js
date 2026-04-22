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
  const pt = /olá|oi|bom dia|boa tarde|boa noite|tudo bem|obrigado|atacado|preço/i;
  return pt.test(text) ? "pt" : "es";
}

async function getBRLRate() {
  try {
    const { data } = await axios.get("https://api.exchangerate-api.com/v4/latest/BRL");
    const rate = (1 / data.rates.ARS).toFixed(2);
    return 💱 Câmbio hoje: 1 ARS = ${rate} BRL;
  } catch {
    return "💱 No pude obtener el cambio hoy.";
  }
}

async function sendMsg(phone, text) {
  await axios.post(
    ${EVOLUTION_URL}/message/sendText/${INSTANCE},
    { number: phone, text },
    { headers: { apikey: EVOLUTION_KEY } }
  );
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (!body?.data?.key || body.data.key.fromMe) return;
    const phone = body.data.key.remoteJid.replace("@s.whatsapp.net", "");
    const text = body.data.message?.conversation ||
                 body.data.message?.extendedTextMessage?.text || "";
    if (!text) return;

    if (!sessions[phone]) {
      sessions[phone] = { step: "getName", lang: detectLang(text), waitingAgent: false };
    }
    const session = sessions[phone];
    if (session.waitingAgent) return;

    if (/agente|humano|persona|asesor/i.test(text)) {
      session.waitingAgent = true;
      await sendMsg(phone, session.lang === "pt"
        ? "Vou te conectar com um atendente! 👤"
        : "¡Te conecto con un agente! 👤");
      await sendMsg(AGENT_NUMBER,
        ⚠️ Cliente necesita atención:\nNúmero: +${phone}\nNombre: ${session.name || "desconocido"});
      return;
    }

    if (/mayorista|atacado|por mayor/i.test(text)) {
      await sendMsg(phone, session.lang === "pt"
        ? 🏪 Para atacado: wa.me/${MAYORISTA_NUMBER}
        : 🏪 Para mayoristas: wa.me/${MAYORISTA_NUMBER});
      return;
    }

    if (session.step === "getName") {
      session.lang = detectLang(text);
      if (/^(hola|hi|oi|olá|buen|buenas|hey)/i.test(text)) {
        await sendMsg(phone, session.lang === "pt"
          ? "Olá! 👋 Bem-vindo ao Mercado Timmy!\nQual é o seu nome?"
          : "¡Hola! 👋 Bienvenido al Mercado Timmy!\n¿Cuál es tu nombre?");
        return;
      }
      session.name = text.trim().split(" ")[0];
      session.step = "menu";
      let msg = session.lang === "pt"
        ? Prazer, ${session.name}! 😊
        : ¡Mucho gusto, ${session.name}! 😊;
      if (session.lang === "pt") {
        const rate = await getBRLRate();
        msg += \n\n${rate};
      }
      msg += session.lang === "pt"
        ? "\n\n¿Como posso ajudar?\n1️⃣ Ofertas da semana\n2️⃣ Preços e produtos\n3️⃣ Falar com atendente"
        : "\n\n¿En qué te ayudo?\n1️⃣ Ofertas de la semana\n2️⃣ Precios y productos\n3️⃣ Hablar con un agente";
      await sendMsg(phone, msg);
      return;
    }

    if (session.step === "menu") {
      if (text === "1") {
        await sendMsg(phone, "🛒 Ofertas de la semana:\n- Arroz 5kg: $2.500\n- Aceite 1.5L: $1.800\n- Yerba 1kg: $3.200\n\n¡Válido hasta el domingo!");
      } else if (text === "2") {
        await sendMsg(phone, session.lang === "pt"
          ? "📦 Diga o nome do produto para consultar preço."
          : "📦 Decime el producto y te doy el precio.");
      } else if (text === "3") {
        session.waitingAgent = true;
        await sendMsg(phone, "👤 Conectando con agente...");
        await sendMsg(AGENT_NUMBER,
          ⚠️ ${session.name || phone} quiere hablar con un agente.\nNúmero: +${phone});
      } else {
        await sendMsg(phone, session.lang === "pt"
          ? "Por favor escolha: 1, 2 ou 3"
          : "Por favor elegí una opción: 1, 2 o 3");
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
});

app.get("/", (_, res) => res.json({ status: "Bot Timmy Market ✅" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Bot corriendo en puerto ${PORT}));
