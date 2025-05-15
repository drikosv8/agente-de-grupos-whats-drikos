require('dotenv').config();
const favicon = require('serve-favicon');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const session = require('express-session');
const path = require('path');
const gruposRoutes = require('./routes/grupos');
const fs = require('fs');
const {
  transcreverAudioComWhisper,
  responderComOpenAI,
  responderComOpenAITTS,
  interpretarImagemComGPT4o
} = require('./openai');
const {
  salvarMensagem,
  buscarContextoDoGrupoHoje,
  buscarPorTermoNoBanco,
  buscarResumoDoDia,
  buscarConfiguracaoDoGrupo
} = require('./mysql');

const app = express();

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'twig');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'grupo-whats-ai',
  resave: false,
  saveUninitialized: true
}));

app.use((req, res, next) => {
  if (req.path === '/login' || req.session.user) return next();
  return res.redirect('/login');
});
app.use('/', gruposRoutes);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'], headless: true }
});

client.on('qr', qr => {
  console.log('📲 Escaneie o QR Code abaixo para conectar seu WhatsApp:');
  qrcode.generate(qr, { small: true });
});

const { gruposDisponiveis } = require('./gruposData');

async function atualizarGruposDisponiveis() {
  try {
    const chats = await client.getChats();

    // ⚠️ limpa mantendo a referência do array exportado
    gruposDisponiveis.length = 0;

    chats
      .filter(chat => chat.isGroup)
      .forEach(grupo => {
        const nome = grupo.name;
        const id = grupo.id._serialized;

        console.log(`📢 Grupo encontrado: ${nome} (${id})`);

        gruposDisponiveis.push({ nome, id });
      });

    console.log(`🔄 ${gruposDisponiveis.length} grupos atualizados com sucesso.`);
  } catch (err) {
    console.error('❌ Erro ao atualizar grupos disponíveis:', err);
  }
}


client.on('ready', async () => {
  console.log('✅ WhatsApp conectado com sucesso.');
  await atualizarGruposDisponiveis();
});



function deveSalvarMensagem(msg, quoted, respostaGerada = false) {
  const corpo = msg.body?.trim().toLowerCase() || '';
  const citado = quoted?.body?.trim().toLowerCase() || '';
  const isComando = corpo.startsWith('/');
  const isRespostaDeComando = citado.startsWith('/');
  if (isComando || isRespostaDeComando) return false;
  if (respostaGerada && msg.body?.startsWith('/')) return false;
  return true;
}

client.on('message', async msg => {
  const grupo = await buscarConfiguracaoDoGrupo(msg.from);
  if (!grupo) return;


  const timeZone = grupo.fuso_horario || 'America/Sao_Paulo';
  const nomeDoBot = grupo.nome_bot?.toLowerCase();
  const body = msg.body?.toLowerCase() || '';
  const quoted = msg.hasQuotedMsg ? await msg.getQuotedMessage() : null;
  const isReplyToBot = quoted?.fromMe || false;
  const isBotMentioned = body.includes(`@${nomeDoBot}`);

  console.log('📥 Mensagem recebida do tipo:', msg.type);

  if (msg.hasMedia && msg.type === 'image') {
    const media = await msg.downloadMedia();
    if (!media?.data) return;
    const filePath = path.join(__dirname, 'imagem.jpg');
    fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
    const descricao = await interpretarImagemComGPT4o(filePath, grupo.id_grupo_whatsapp);
    if (isBotMentioned || isReplyToBot) {
      await client.sendMessage(msg.from, descricao);
      if (deveSalvarMensagem(msg, quoted)) await salvarMensagem({ from: msg.from, author: 'BOT', body: descricao });
    } else if (deveSalvarMensagem(msg, quoted)) {
      await salvarMensagem({ from: msg.from, author: msg.author, body: descricao });
    }
    fs.unlinkSync(filePath);
    return;
  }

  if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
    const media = await msg.downloadMedia();
    if (!media?.data) return;
    const filePath = path.join(__dirname, 'audio.ogg');
    fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
    const transcricao = await transcreverAudioComWhisper(filePath, grupo.id_grupo_whatsapp);
    fs.unlinkSync(filePath);
    if (transcricao) {
      await salvarMensagem({ from: msg.from, author: msg.author, body: transcricao });
      if (isReplyToBot) {
        const contexto = await buscarContextoDoGrupoHoje(msg.from);
        const respostaTexto = await responderComOpenAI(transcricao, contexto, grupo.id_grupo_whatsapp);
        const respostaAudio = await responderComOpenAITTS(respostaTexto, grupo.id_grupo_whatsapp);
        const audioMedia = new MessageMedia('audio/ogg; codecs=opus', respostaAudio.toString('base64'), 'resposta.ogg');
        await client.sendMessage(msg.from, audioMedia, { sendAudioAsVoice: true });
        if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: respostaTexto });
      }
    }
    return;
  }

  if (deveSalvarMensagem(msg, quoted)) await salvarMensagem(msg);

  if (isReplyToBot && msg.type === 'chat') {
    const contexto = await buscarContextoDoGrupoHoje(msg.from);
    const resposta = await responderComOpenAI(msg.body, contexto, grupo.id_grupo_whatsapp);
    await client.sendMessage(msg.from, resposta);
    if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resposta });
    return;
  }

  if (body === '/ajuda') {
    const ajuda = `🧠 *Comandos disponíveis:*
- @${nomeDoBot} sua pergunta → responder com IA (também funciona se responder o bot)

- /buscar termo → busca no histórico do grupo

- /resumo hoje | ontem | semana → gera resumos com IA

- Envie áudio → transcreve e responde

- Envie imagem → interpreta visualmente

By Driko's v8`;
    await client.sendMessage(msg.from, ajuda);
    return;
  }

  if (body.startsWith(`@${nomeDoBot}`)) {
    const pergunta = msg.body.replace(`@${nomeDoBot}`, '').trim();
    const contexto = await buscarContextoDoGrupoHoje(msg.from);
    const resposta = await responderComOpenAI(pergunta, contexto, grupo.id_grupo_whatsapp);
    await client.sendMessage(msg.from, resposta);
    if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resposta });
    return;
  }

  if (body.startsWith('/buscar ')) {
    const termo = msg.body.replace('/buscar', '').trim();
    const resultado = await buscarPorTermoNoBanco(msg.from, termo);
    const resposta = resultado || '❌ Nenhuma informação encontrada para esse termo.';
    await client.sendMessage(msg.from, resposta);
    return;
  }

  if (body === '/resumo hoje' || body === '/resumo diário') {
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone });
    const resultado = await buscarResumoDoDia(msg.from, hoje);
    if (resultado) {
      const resumo = await responderComOpenAI(`Resuma em tópicos claros tudo que foi tratado no grupo hoje:\n${resultado}`, '', grupo.id_grupo_whatsapp);
      await client.sendMessage(msg.from, resumo);
      if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resumo });
    } else {
      await client.sendMessage(msg.from, 'Nenhuma informação registrada hoje.');
    }
    return;
  }

  if (body === '/resumo ontem') {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const dataOntem = ontem.toLocaleDateString('sv-SE', { timeZone });
    const resultado = await buscarResumoDoDia(msg.from, dataOntem);
    if (resultado) {
      const resumo = await responderComOpenAI(`Resuma em tópicos o que foi tratado no grupo ontem:\n${resultado}`, '', grupo.id_grupo_whatsapp);
      await client.sendMessage(msg.from, resumo);
      if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resumo });
    } else {
      await client.sendMessage(msg.from, 'Nenhuma informação registrada ontem.');
    }
    return;
  }

  if (body === '/resumo semana') {
    const hoje = new Date();
    const segunda = new Date(hoje.setDate(hoje.getDate() - hoje.getDay() + 1));
    const datas = [...Array(5)].map((_, i) => {
      const d = new Date(segunda);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
    let textoCompleto = '';
    for (const data of datas) {
      const parcial = await buscarResumoDoDia(msg.from, data);
      if (parcial) textoCompleto += parcial + '\n';
    }
    if (textoCompleto) {
      const resumo = await responderComOpenAI(`Resuma em tópicos tudo que foi tratado no grupo esta semana:\n${textoCompleto}`, '', grupo.id_grupo_whatsapp);
      await client.sendMessage(msg.from, resumo);
      if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resumo });
    } else {
      await client.sendMessage(msg.from, 'Nenhuma informação registrada esta semana.');
    }
    return;
  }
});

const PORT = process.env.PORT;
if (!PORT) {
  console.error('❌ Variável PORT não definida no .env');
  process.exit(1);
}

client.initialize();
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT}`));


