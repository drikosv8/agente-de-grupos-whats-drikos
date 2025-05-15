const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { buscarConfiguracaoDoGrupo } = require('./mysql');

async function responderComOpenAI(pergunta, contexto, idGrupoWhatsapp) {
  try {
    const grupo = await buscarConfiguracaoDoGrupo(idGrupoWhatsapp);
    if (!grupo) return '⚠️ Configuração do grupo não encontrada.';

    const apiKey = grupo.openai_api_key?.trim();
    const hoje = new Date();
    const dia = hoje.toLocaleDateString('pt-BR');
    const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const messages = [
      {
        role: 'system',
        content: `${grupo.comportamento || 'Você é um assistente útil.'}
Hoje é ${dia}, ${hora}.`
      },
      {
        role: 'user',
        content: `Histórico do dia:\n${contexto}\n\nPergunta: ${pergunta}`
      }
    ];

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: grupo.modelo_ai,
        messages
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    return response.data.choices?.[0]?.message?.content || '❌ Sem resposta gerada pela IA.';
  } catch (error) {
    console.error('[OpenAI] Erro:', error.response?.data || error.message);
    return '❌ Erro ao consultar a IA.';
  }
}

async function transcreverAudioComWhisper(filePath, idGrupoWhatsapp) {
  try {
    const grupo = await buscarConfiguracaoDoGrupo(idGrupoWhatsapp);
    if (!grupo) return null;

    const apiKey = grupo.openai_api_key?.trim();
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'whisper-1');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...form.getHeaders()
        }
      }
    );

    return response.data.text?.trim() || null;
  } catch (err) {
    console.error('[Whisper] Erro:', err.response?.data || err.message);
    return null;
  }
}

async function responderComOpenAITTS(texto, idGrupoWhatsapp) {
  try {
    const grupo = await buscarConfiguracaoDoGrupo(idGrupoWhatsapp);
    if (!grupo) return null;

    const apiKey = grupo.openai_api_key?.trim();

    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        voice: grupo.voz_ai,
        input: texto
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return Buffer.from(response.data);
  } catch (err) {
    console.error('[TTS] Erro ao gerar áudio:', err.response?.data || err.message);
    return null;
  }
}

async function interpretarImagemComGPT4o(imagePath, idGrupoWhatsapp) {
  try {
    const grupo = await buscarConfiguracaoDoGrupo(idGrupoWhatsapp);
    if (!grupo) return '⚠️ Grupo não configurado.';

    const apiKey = grupo.openai_api_key?.trim();
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: grupo.modelo_ai,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'O que você vê nesta imagem?' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices?.[0]?.message?.content || '❌ A IA não conseguiu interpretar a imagem.';
  } catch (err) {
    console.error('[GPT-4o Image] Erro:', err.response?.data || err.message);
    return '❌ Erro ao interpretar a imagem.';
  }
}

module.exports = {
  responderComOpenAI,
  transcreverAudioComWhisper,
  responderComOpenAITTS,
  interpretarImagemComGPT4o
};
