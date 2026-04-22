const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;
const MAYORISTA = "543757574452";
const AGENT = process.env.AGENT_NUMBER;
const sessions = {};

function getLang(text) {
  return /oi|ola|bom dia|boa|obrigado|atacado|preco/i.test(text) ? "pt" : "es";
}

function getRate() {
  return "Cambio del dia: $" + (process.env.BRL_RATE || "275") + " pesos = 1 Real";
}

async function send(phone, text) {
  try {
    await axios.post(
      EVOLUTION_URL + "/message/sendText/" + INSTANCE,
      { number: phone, text: text },
      { headers: { apikey: EVOLUTION_KEY } }
    );
  } catch (e) {
    console.error("Error enviando:", e.message);
  }
}

app.post("/webhook", async function(req, res) {
  res.sendStatus(200);
  try {
    var body = req.body;
    if (!body || !body.data || !body.data.key) return;
    if (body.data.key.fromMe) return;
    var phone = body.data.key.remoteJid.replace("@s.whatsapp.net", "");
    var msg = body.data.message;
    var text = "";
    if (msg && msg.conversation) text = msg.conversation;
    else if (msg && msg.extendedTextMessage) text = msg.extendedTextMessage.text;
    if (!text) return;

    if (!sessions[phone]) sessions[phone] = { step: "start", lang: getLang(text), waiting: false };
    var s = sessions[phone];
    if (s.waiting) return;

    if (/agente|humano|asesor|persona/i.test(text)) {
      s.waiting = true;
      await send(phone, s.lang === "pt" ? "Conectando com atendente..." : "Conectando con agente...");
      await send(AGENT, "Cliente necesita atencion: +" + phone + " Nombre: " + (s.name || "desconocido"));
      return;
    }

    if (/mayorista|atacado|por mayor/i.test(text)) {
      await send(phone, s.lang === "pt" ? "Para atacado: wa.me/" + MAYORISTA : "Para mayoristas: wa.me/" + MAYORISTA);
      return;
    }

    if (s.step === "start") {
      s.lang = getLang(text);
      if (/hola|hi|oi|ola|buen|hey/i.test(text)) {
        await send(phone, s.lang === "pt" ? "Ola! Bem-vindo ao Mercado Timmy! Qual e o seu nome?" : "Hola! Bienvenido al Mercado Timmy! Cual es tu nombre?");
        s.step = "getName";
        return;
      }
      s.name = text.trim().split(" ")[0];
      s.step = "menu";
      var welcome = s.lang === "pt" ? "Prazer " + s.name + "!" : "Mucho gusto " + s.name + "!";
      if (s.lang === "pt") welcome = welcome + "\n" + getRate();
      welcome = welcome + (s.lang === "pt" ? "\n\n1 - Ofertas da semana\n2 - Precos\n3 - Atendente" : "\n\n1 - Ofertas de la semana\n2 - Precios\n3 - Hablar con agente");
      await send(phone, welcome);
      return;
    }

    if (s.step === "getName") {
      s.name = text.trim().split(" ")[0];
      s.step = "menu";
      var reply = s.lang === "pt" ? "Prazer " + s.name + "!" : "Mucho gusto " + s.name + "!";
      if (s.lang === "pt") reply = reply + "\n" + getRate();
      reply = reply + (s.lang === "pt" ? "\n\n1 - Ofertas\n2 - Precos\n3 - Atendente" : "\n\n1 - Ofertas\n2 - Precios\n3 - Agente");
      await send(phone, reply);
      return;
    }

    if (s.step === "menu") {
      if (text === "1") {
        await send(phone, "Ofertas de la semana:\n- Arroz 5kg: $2.500\n- Aceite 1.5L: $1.800\n- Yerba 1kg: $3.200\nValido hasta el domingo!");
      } else if (text === "2") {
        await send(phone, s.lang === "pt" ? "Diga o nome do produto." : "Decime el producto.");
      } else if (text === "3") {
        s.waiting = true;
        await send(phone, "Conectando con agente...");
        await send(AGENT, (s.name || phone) + " quiere hablar. Numero: +" + phone);
      } else {
        await send(phone, s.lang === "pt" ? "Escolha 1, 2 ou 3" : "Elegi 1, 2 o 3");
      }
    }
  } catch (err) {
    console.error("Error webhook:", err.message);
  }
});

app.get("/", function(req, res) { res.json({ status: "Bot OK" }); });
app.listen(process.env.PORT || 3000, function() { console.log("Bot corriendo"); });
