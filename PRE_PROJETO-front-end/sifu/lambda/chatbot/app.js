const crypto = require('crypto');
const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const dynamodb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const knowledgeBase = [
  'O SIFU e o sistema usado para envio e acompanhamento do pre-projeto de TCC.',
  'O usuario precisa enviar um unico arquivo PDF com todos os documentos assinados.',
  'O tamanho maximo do PDF de pre-projeto e 10MB.',
  'Depois do envio, o status inicial da submissao fica Em analise.',
  'A rota POST /chatbot exige login e token JWT do Cognito no header Authorization.',
  'As conversas do chatbot sao registradas na tabela DynamoDB configurada em CHAT_MESSAGES_TABLE.',
  'Quando o Bedrock esta disponivel no laboratorio, o chatbot usa o modelo definido em BEDROCK_MODEL_ID.',
  'Quando o Bedrock nao esta disponivel, a Lambda usa respostas locais baseadas no contexto e na base de conhecimento.',
];

function response(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function getClaims(event) {
  return event.requestContext?.authorizer?.claims || {};
}

function getPrompt(payload) {
  return String(payload.message || payload.chat || '').trim();
}

function normalizeContext(context) {
  if (!context || typeof context !== 'object') {
    return {
      interactionSource: 'desconhecida',
      user: {},
      submissionSummary: {},
    };
  }

  return {
    interactionSource: String(context.interactionSource || 'desconhecida'),
    user: context.user && typeof context.user === 'object' ? context.user : {},
    submissionSummary:
      context.submissionSummary && typeof context.submissionSummary === 'object'
        ? context.submissionSummary
        : {},
  };
}

function formatUserContext(context, fallbackName) {
  const normalized = normalizeContext(context);
  const userName = String(normalized.user.nome || fallbackName || 'usuario');
  const userRegistration = String(normalized.user.matricula || 'matricula nao informada');
  const userEmail = String(normalized.user.email || '');
  const userIdentity = userEmail
    ? `${userName} (${userEmail}), matricula: ${userRegistration}`
    : `${userName}, autenticado pelo Google. Identificador do usuario: ${userRegistration}`;
  const latestStatus = String(normalized.submissionSummary.latestStatus || 'Nao enviado');
  const totalSubmissions = Number(normalized.submissionSummary.totalSubmissions || 0);
  const lastSubmission = normalized.submissionSummary.lastSubmission;
  const lastFile =
    lastSubmission && typeof lastSubmission === 'object'
      ? String(lastSubmission.fileName || 'arquivo nao informado')
      : 'nenhum arquivo enviado nesta sessao';

  return {
    name: userName,
    lines: [
      `Fonte da interacao: ${normalized.interactionSource}.`,
      `Usuario logado: ${userIdentity}.`,
      `Status mais recente do pre-projeto nesta sessao: ${latestStatus}.`,
      `Total de submissoes registradas no front-end nesta sessao: ${totalSubmissions}.`,
      `Ultimo arquivo conhecido: ${lastFile}.`,
    ],
  };
}

function selectKnowledge(prompt) {
  const normalized = normalizeText(prompt);

  if (normalized.includes('pdf') || normalized.includes('arquivo') || normalized.includes('documento')) {
    return knowledgeBase.filter((item) => item.includes('PDF') || item.includes('10MB'));
  }

  if (normalized.includes('status') || normalized.includes('submiss') || normalized.includes('projeto')) {
    return knowledgeBase.filter((item) => item.includes('SIFU') || item.includes('status') || item.includes('submissao'));
  }

  if (normalized.includes('login') || normalized.includes('token') || normalized.includes('cognito')) {
    return knowledgeBase.filter((item) => item.includes('token') || item.includes('Cognito'));
  }

  if (normalized.includes('bedrock') || normalized.includes('ia') || normalized.includes('historico')) {
    return knowledgeBase.filter((item) => item.includes('Bedrock') || item.includes('DynamoDB') || item.includes('Lambda'));
  }

  return knowledgeBase.slice(0, 4);
}

function fallbackAnswer(prompt, userContext) {
  const normalized = normalizeText(prompt);
  const knowledge = selectKnowledge(prompt).join(' ');
  const contextSummary = userContext.lines.join(' ');
  const pdfContext = userContext.pdf
    ? ` Pre-projeto processado: ${userContext.pdf.summary || userContext.pdf.extractedText || ''}`
    : '';

  if (normalized.includes('resum') && normalized.includes('projeto')) {
    if (!userContext.pdf) {
      return `Ola, ${userContext.name}! Ainda nao encontrei um PDF de pre-projeto processado para resumir. Envie o PDF e aguarde o processamento terminar.`;
    }

    if (userContext.pdf.processingStatus !== 'ready' && userContext.pdf.processingStatus !== 'empty_text') {
      return `Ola, ${userContext.name}! Seu pre-projeto foi encontrado, mas o processamento ainda esta em andamento. Status atual: ${userContext.pdf.processingStatus}. Tente novamente em instantes.`;
    }

    return `Ola, ${userContext.name}! Aqui esta o resumo do pre-projeto "${userContext.pdf.fileName}": ${userContext.pdf.summary || userContext.pdf.extractedText || 'Nao consegui extrair texto suficiente do PDF.'}`;
  }

  if (normalized.includes('prazo') || normalized.includes('data')) {
    return `Ola, ${userContext.name}! Ainda nao tenho um calendario de edital cadastrado. Com base no contexto da sua interacao: ${contextSummary} Posso orientar o fluxo do SIFU e voce pode informar qual etapa ou edital quer conferir.`;
  }

  if (normalized.includes('tcc') || normalized.includes('projeto')) {
    return `Ola, ${userContext.name}! Pelo que recebi desta sessao: ${contextSummary}${pdfContext} Pela base previamente disponibilizada: ${knowledge}`;
  }

  if (normalized.includes('contexto') || normalized.includes('sabe sobre mim') || normalized.includes('interacao')) {
    return `Ola, ${userContext.name}! Estou respondendo com base nestas informacoes da interacao: ${contextSummary} Tambem uso a base do SIFU/laboratorio: ${knowledge}`;
  }

  return `Ola, ${userContext.name}! Recebi sua mensagem: "${prompt}". Contexto usado: ${contextSummary}${pdfContext} Conhecimento previo usado: ${knowledge}`;
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function getLatestProcessedSubmission(userId) {
  const tableName = process.env.SUBMISSIONS_TABLE;
  if (!tableName || !userId) return null;

  const result = await dynamodb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: userId },
      },
      ScanIndexForward: false,
      Limit: 5,
    }),
  );

  const item = (result.Items || []).find((candidate) => candidate.processingStatus?.S);
  if (!item) return null;

  return {
    submissionId: item.submissionId?.S || '',
    fileName: item.fileName?.S || 'pre-projeto.pdf',
    createdAt: item.createdAt?.S || '',
    processingStatus: item.processingStatus?.S || 'desconhecido',
    summary: item.pdfSummary?.S || '',
    extractedText: item.extractedText?.S || '',
    pageCount: Number(item.pageCount?.N || 0),
  };
}

async function askAi(prompt, name, context, pdf) {
  const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';
  const userContext = formatUserContext(context, name);
  userContext.pdf = pdf;
  const selectedKnowledge = selectKnowledge(prompt);
  const pdfLines = pdf
    ? [
        `PDF mais recente: ${pdf.fileName}.`,
        `Status do processamento do PDF: ${pdf.processingStatus}.`,
        `Resumo salvo do PDF: ${pdf.summary || 'sem resumo salvo'}.`,
        `Trecho do texto extraido: ${(pdf.extractedText || '').slice(0, 12000) || 'sem texto extraido'}.`,
      ].join('\n')
    : 'Nenhum PDF de pre-projeto processado encontrado para este usuario.';
  const body = {
    messages: [
      {
        role: 'user',
        content: [
          {
            text: [
              'Voce e o assistente do SIFU, sistema academico da UFERSA.',
              'Responda em portugues, de forma curta e util.',
              'Mostre quando estiver usando informacoes da interacao com o usuario.',
              'Mostre quando estiver usando conhecimento previamente disponibilizado ao agente.',
              'Quando o usuario pedir resumo, analise ou explicacao do pre-projeto, use o PDF processado abaixo.',
              'Nao invente dados que nao estejam no contexto ou na base.',
              `Contexto da interacao: ${userContext.lines.join(' ')}`,
              `Conhecimento previo do SIFU/laboratorio: ${selectedKnowledge.join(' ')}`,
              `PDF processado do usuario: ${pdfLines}`,
              `Mensagem do usuario: ${prompt}`,
            ].join('\n'),
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 260,
      temperature: 0.3,
    },
  };

  try {
    const result = await bedrock.send(
      new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      }),
    );

    const decoded = JSON.parse(Buffer.from(result.body).toString('utf8'));
    return decoded.output?.message?.content?.[0]?.text || fallbackAnswer(prompt, userContext);
  } catch (error) {
    console.warn('Bedrock indisponivel no laboratorio, usando fallback do assistente.', error.name);
    return fallbackAnswer(prompt, userContext);
  }
}

async function saveChat({ userId, email, name, prompt, context, answer, aiProvider }) {
  const tableName = process.env.CHAT_MESSAGES_TABLE;
  if (!tableName) return;

  try {
    await dynamodb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          userId: { S: userId },
          createdAt: { S: new Date().toISOString() },
          messageId: { S: crypto.randomUUID() },
          email: { S: email },
          name: { S: name },
          request: { S: prompt },
          context: { S: JSON.stringify(context) },
          response: { S: answer },
          aiProvider: { S: aiProvider },
        },
      }),
    );
  } catch (error) {
    console.warn('Nao foi possivel salvar historico do chat.', error.name);
  }
}

exports.handler = async (event) => {
  try {
    const claims = getClaims(event);
    const userId = String(claims.sub || claims['cognito:username'] || 'usuario-autenticado');
    const email = String(claims.email || '');
    const name = String(claims.name || email || 'usuario');
    const payload = event.body ? JSON.parse(event.body) : {};
    const prompt = getPrompt(payload);
    const context = normalizeContext(payload.context);

    if (!prompt) {
      return response(400, {
        message: 'Envie um JSON no formato {"message":"sua pergunta"}.',
      });
    }

    const latestPdf = await getLatestProcessedSubmission(userId);
    const answer = await askAi(prompt, name, context, latestPdf);

    await saveChat({
      userId,
      email,
      name,
      prompt,
      context,
      answer,
      aiProvider: process.env.BEDROCK_MODEL_ID || 'fallback',
    });

    return response(200, {
      message: answer,
      request: {
        message: prompt,
        context,
      },
      ai: {
        provider: process.env.BEDROCK_MODEL_ID || 'fallback',
      },
    });
  } catch (error) {
    console.error(error);
    return response(500, {
      message: 'Nao foi possivel processar a mensagem do chat.',
    });
  }
};
