require('dotenv').config();
const axios = require('axios');
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
  buscarConfiguracaoDoGrupo,
  buscarIntegracaoEmbyPorGrupo
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

  if (msg.hasMedia && msg.type === 'image' && (isBotMentioned || isReplyToBot)) {
    const media = await msg.downloadMedia();
    if (!media?.data) return;
    const filePath = path.join(__dirname, 'imagem.jpg');
    fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
    const descricao = await interpretarImagemComGPT4o(filePath, grupo.id_grupo_whatsapp);
    if (isBotMentioned || isReplyToBot) {
      await msg.reply(descricao);
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
      const contato = await msg.getContact();
const nomeAutor = contato.pushname || contato.name || msg.author?.split('@')[0] || 'BOT';

await salvarMensagem({ from: msg.from, author: nomeAutor, body: transcricao });

      if (isReplyToBot) {
        const contexto = await buscarContextoDoGrupoHoje(msg.from, client);
        const respostaTexto = await responderComOpenAI(transcricao, contexto, grupo.id_grupo_whatsapp);
        const respostaAudio = await responderComOpenAITTS(respostaTexto, grupo.id_grupo_whatsapp);
        const audioMedia = new MessageMedia('audio/ogg; codecs=opus', respostaAudio.toString('base64'), 'resposta.ogg');
        await msg.reply(audioMedia, undefined, { sendAudioAsVoice: true });
        if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: respostaTexto });
      }
    }
    return;
  }

  // Só salva mensagens de texto normais
if (msg.type === 'chat' && deveSalvarMensagem(msg, quoted)) {
  await salvarMensagem(msg);
}


  if (isReplyToBot && msg.type === 'chat') {
    const contexto = await buscarContextoDoGrupoHoje(msg.from, client);
    const resposta = await responderComOpenAI(msg.body, contexto, grupo.id_grupo_whatsapp);
    await msg.reply(resposta);
    if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resposta });
    return;
  }

  if (body === '/ajuda') {
    const ajuda = `🧠 *Comandos disponíveis:*
- *@${nomeDoBot}* sua pergunta → responder com IA (também funciona se responder o bot)

- */buscar* termo → busca no histórico do grupo

- */resumo* hoje | ontem | semana → gera resumos com IA

- *Envie áudio* → transcreve e responde

- *Envie imagem* → interpreta visualmente

- */filme* titulo → busca no acervo de filmes

- */serie* titulo → busca no acervo de séries

By Driko's v8`;
    await msg.reply(ajuda);
    return;
  }

if (isBotMentioned && msg.type === 'chat') {
  const pergunta = msg.body.replace(`@${nomeDoBot}`, '').trim();
  const contexto = await buscarContextoDoGrupoHoje(msg.from, client);
  const resposta = await responderComOpenAI(pergunta, contexto, grupo.id_grupo_whatsapp);
  await msg.reply(resposta);
  if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resposta });
  return;
}


  if (body.startsWith('/buscar ')) {
    const termo = msg.body.replace('/buscar', '').trim();
    const resultado = await buscarPorTermoNoBanco(msg.from, termo, client);
    const resposta = resultado || '❌ Nenhuma informação encontrada para esse termo.';
    await msg.reply(resposta);
    return;
  }

if (body === '/resumo hoje' || body === '/resumo diário') {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone });
  const resultado = await buscarResumoDoDia(msg.from, hoje);

  if (resultado) {
    const prompt = `Resuma em tópicos claros tudo que foi tratado no grupo hoje:\n${resultado}`;
    let resposta = await responderComOpenAI(prompt, '', grupo.id_grupo_whatsapp);


    await msg.reply(resposta);
  } else {
    await msg.reply('Nenhuma informação registrada hoje.');
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
      await msg.reply(resumo);
      if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resumo });
    } else {
      await msg.reply('Nenhuma informação registrada ontem.');
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
      const parcial = await buscarResumoDoDia(msg.from, data, client);
      if (parcial) textoCompleto += parcial + '\n';
    }
    if (textoCompleto) {
      const resumo = await responderComOpenAI(`Resuma em tópicos tudo que foi tratado no grupo esta semana:\n${textoCompleto}`, '', grupo.id_grupo_whatsapp);
      await msg.reply(resumo);
      if (deveSalvarMensagem(msg, quoted, true)) await salvarMensagem({ from: msg.from, author: 'BOT', body: resumo });
    } else {
      await msg.reply('Nenhuma informação registrada esta semana.');
    }
    return;
  }
  
// 🔎 /filme nome-parcial
if (body.startsWith('/filme ')) {
  const termo = msg.body.replace('/filme', '').trim();
  if (!termo) return;

  const integracao = await buscarIntegracaoEmbyPorGrupo(msg.from);
  if (!integracao) {
    await msg.reply('❌ Nenhuma integração Emby encontrada para este grupo.\n\nHabilite o módulo em integrações para usar.');
    return;
  }


const contato = await msg.getContact();
const nomeMenor = contato.pushname || contato.name || 'amigo';

let idAutor = msg.from; // padrão para privado
let numeroMen = '';

if (msg.from.endsWith('@g.us') && msg.author) {
  idAutor = msg.author;
}

if (idAutor && idAutor.includes('@')) {
  numeroMen = idAutor.split('@')[0];

  await client.sendMessage(msg.from, `@${numeroMen} Deixa comigo! Vou verificar agora mesmo se temos em nosso acervo 😄`, {
    mentions: [idAutor]
  });
} else {
  console.warn('⚠️ ID de autor inválido ou ausente. Pulando saudação.');
}



await delay(4000); // Espera 4 segundos antes de enviar os resultados


const resultados = await buscarEmbyConteudo(integracao, termo, 'Movie');

if (!Array.isArray(resultados) || resultados.length === 0) {
  await msg.reply('❌ Nenhum filme encontrado.');
  return;
}

for (const item of resultados) {
  await enviarImagemComLegendaWhatsApp(client, msg.from, item, integracao, msg);
  await delay(2000); // ⏱️ 2 segundo entre envios
}

} // ✅ FECHANDO o if do /filme




// 🔎 /serie nome-parcial
if (body.startsWith('/serie ')) {
  const termo = msg.body.replace('/serie', '').trim();
  if (!termo) return;

  const integracao = await buscarIntegracaoEmbyPorGrupo(msg.from);
  if (!integracao) {
    await msg.reply('❌ Nenhuma integração Emby encontrada para este grupo.\n\nHabilite o módulo em integrações para usar.');
    return;
  }

const contato = await msg.getContact();
const nomeMenor = contato.pushname || contato.name || 'amigo';

let idAutor = msg.from; // padrão para privado
let numeroMen = '';

if (msg.from.endsWith('@g.us') && msg.author) {
  idAutor = msg.author;
}

if (idAutor && idAutor.includes('@')) {
  numeroMen = idAutor.split('@')[0];

  await client.sendMessage(msg.from, `@${numeroMen} Deixa comigo! Vou verificar agora mesmo se temos em nosso acervo 😄`, {
    mentions: [idAutor]
  });
} else {
  console.warn('⚠️ ID de autor inválido ou ausente. Pulando saudação.');
}






await delay(4000); // Espera 4 segundos antes de enviar os resultados


const resultados = await buscarEmbyConteudo(integracao, termo, 'Series');

if (!Array.isArray(resultados) || resultados.length === 0) {
  await msg.reply('❌ Nenhuma série encontrada.');
  return;
}

for (const item of resultados) {
  await enviarImagemComLegendaWhatsApp(client, msg.from, item, integracao, msg);
  await delay(2000); // ⏱️ 2 segundo entre envios
}
}

});


async function buscarEmbyConteudo(integracao, termo, tipo) {
  try {
    const userId = integracao.user_id;
    const tipoEsperado = tipo === 'Movie' ? 'Movie' : 'Series';

    // 1. Buscar bibliotecas (CollectionFolder)
    const colecoes = await axios.get(`${integracao.url}/emby/Users/${userId}/Items`, {
      params: {
        IncludeItemTypes: 'CollectionFolder',
        Recursive: false,
        api_key: integracao.api_key
      },
      headers: {
        'X-Emby-Token': integracao.api_key
      }
    });

    const pastas = colecoes.data.Items || [];

    // 2. Para cada pasta, procurar o conteúdo
    for (const pasta of pastas) {
      const busca = await axios.get(`${integracao.url}/emby/Users/${userId}/Items`, {
        params: {
          SearchTerm: termo,
          ParentId: pasta.Id,
          Recursive: true,
          Fields: 'ProductionYear,Genres,Overview,PrimaryImageAspectRatio,CommunityRating',
          EnableImages: true,
          EnableImageTypes: 'Primary',
          SortOrder: 'Descending',
          Limit: 100,
          api_key: integracao.api_key
        },
        headers: {
          'X-Emby-Token': integracao.api_key
        }
      });

// 3. Filtrar por tipo esperado
const encontrados = (busca.data.Items || []).filter(item =>
  item.Type === tipoEsperado &&
  item.Name?.toLowerCase().includes(termo.toLowerCase())
);

if (encontrados.length > 0) {
const resposta = encontrados.slice(0, 3).map(item => {
  const nome = item.Name || 'Sem título';
  const ano = item.ProductionYear || 'Ano indefinido';
  const genero = item.Genres?.join(', ') || 'Gênero não informado';
  const sinopse = item.Overview || 'Sem sinopse disponível.';
  const nota = (typeof item.CommunityRating === 'number' && !isNaN(item.CommunityRating))
    ? item.CommunityRating.toFixed(1)
    : 'N/A';
  const imagem = `${integracao.url}/emby/Items/${item.Id}/Images/Primary?tag=${item.ImageTags?.Primary}&api_key=${integracao.api_key}`;

  return `🎬 *${nome}* (${ano})\n🎭 ${genero}\n⭐ *Nota:* ${nota}\n📝 ${sinopse}\n🖼️ ${imagem}`;
});


		return encontrados.slice(0, 3); // retorna os objetos puros

      }
    }

    return []; // retorna array vazio, evita erro

  } catch (err) {
    console.error('❌ Erro ao buscar sua solicitação:', err.message);
    return []; // ❌ retorna string, o que quebra o for...of
  }
}




function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function enviarImagemComLegendaWhatsApp(client, chatId, item, integracao, msg) {
  if (!item || typeof item !== 'object') {
    console.warn(`⚠️ Item inválido recebido:`, item);
    return;
  }

  if (!item.ImageTags || !item.ImageTags.Primary) {
    console.warn(`⚠️ Série sem imagem PRIMARY detectada: ${item.Name || '??'} (ID: ${item.Id || '??'}, Type: ${item.Type || '??'})`);
    return;
  }

  const imagemUrl = `${integracao.url}/emby/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}&api_key=${integracao.api_key}`;

  try {
    const response = await axios.get(imagemUrl, {
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data, 'binary');
    const media = new MessageMedia('image/jpeg', buffer.toString('base64'), `${item.Name}.jpg`);

const nota = (typeof item.CommunityRating === 'number' && !isNaN(item.CommunityRating))
  ? item.CommunityRating.toFixed(1)
  : 'N/A';

const nomeMenor = msg._data?.notifyName || 'amigo';

const legenda = `🎬 *Título:* ${item.Name || 'Sem título'}\n` +
                `📆 *Ano:* ${item.ProductionYear || 'Indefinido'}\n` +
                `🎭 *Gênero:* ${item.Genres?.join(', ') || 'Não informado'}\n` +
                `⭐ *Nota:* ${nota}\n` +
                `📝 *Sinopse:* ${item.Overview || 'Sem sinopse disponível.'}\n\n` +
                `👤 *Solicitado por:* ${nomeMenor}`;



    await msg.reply(media, undefined, { caption: legenda });

  } catch (error) {
    console.error('❌ Erro ao enviar imagem com legenda:', error.message);
    await msg.reply(`⚠️ Erro ao enviar imagem: *${item.Name}*`);
  }
}


const PORT = process.env.PORT;
if (!PORT) {
  console.error('❌ Variável PORT não definida no .env');
  process.exit(1);
}

client.initialize();
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT}`));


