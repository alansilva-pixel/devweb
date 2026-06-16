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

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function shouldUsePdf(prompt) {
  const normalized = normalizeText(prompt);
  return hasAny(normalized, [
    'pdf',
    'arquivo',
    'documento',
    'pre projeto',
    'pre-projeto',
    'tcc',
    'resum',
    'analise',
    'analisar',
    'tema',
    'objetivo',
    'metodologia',
  ]);
}

function clip(text, maxLength = 1200) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function fallbackAnswer(prompt, userContext) {
  const normalized = normalizeText(prompt);
  const pdf = userContext.pdf;

  if (hasAny(normalized, ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'])) {
    return `Ola, ${userContext.name}! Sou o Assistente SIFU. Posso ajudar com envio, status, regras do PDF e resumo do seu pre-projeto.`;
  }

  if (
    hasAny(normalized, ['quem esta falando', 'quem ta falando', 'quem fala', 'quem sou eu', 'minha conta']) ||
    (normalized.includes('quem') && normalized.includes('voce') && normalized.includes('falando'))
  ) {
    return `Voce esta logado como ${userContext.name}. Se essa nao for a conta correta, saia e entre novamente escolhendo a conta desejada no Google.`;
  }

  if (hasAny(normalized, ['quem e voce', 'quem eh voce', 'o que voce e', 'sua funcao'])) {
    return 'Eu sou o Assistente SIFU, criado para ajudar com o envio e acompanhamento do pre-projeto de TCC.';
  }

  if (hasAny(normalized, ['status', 'situacao', 'andamento'])) {
    const statusLine =
      userContext.lines.find((line) => normalizeText(line).includes('status mais recente')) ||
      'Status mais recente do pre-projeto: Nao enviado.';
    return `${statusLine} Para atualizar o status, confira tambem a tela "Minhas Submissoes".`;
  }

  if (normalized.includes('resum') && normalized.includes('projeto')) {
    if (!pdf) {
      return `Ola, ${userContext.name}! Ainda nao encontrei um PDF de pre-projeto processado para resumir. Envie o PDF e aguarde o processamento terminar.`;
    }

    if (pdf.processingStatus !== 'ready' && pdf.processingStatus !== 'empty_text') {
      return `Encontrei seu envio, mas o PDF ainda esta em processamento. Status atual: ${pdf.processingStatus}. Tente novamente em instantes.`;
    }

    return `Resumo do arquivo "${pdf.fileName}": ${clip(pdf.summary || pdf.extractedText || 'Nao consegui extrair texto suficiente do PDF.')}`;
  }

  if (shouldUsePdf(prompt)) {
    if (!pdf) {
      return 'Ainda nao encontrei um PDF processado para essa conta. Envie o pre-projeto em PDF e aguarde o processamento.';
    }

    if (pdf.processingStatus !== 'ready' && pdf.processingStatus !== 'empty_text') {
      return `O PDF foi encontrado, mas ainda nao esta pronto para consulta. Status atual: ${pdf.processingStatus}.`;
    }

    return `Sobre o arquivo "${pdf.fileName}": ${clip(pdf.summary || pdf.extractedText || 'Nao consegui extrair texto suficiente do PDF.')}`;
  }

  if (normalized.includes('prazo') || normalized.includes('data')) {
    return 'Ainda nao tenho um calendario de edital cadastrado. Para prazos oficiais, confira o edital/coordenacao. Posso ajudar a entender o fluxo de envio e acompanhamento no SIFU.';
  }

  if (hasAny(normalized, ['como enviar', 'enviar', 'submeter', 'submissao', 'mandar'])) {
    return 'Para enviar o pre-projeto, acesse "Enviar Pre-Projeto", preencha os dados do orientador, selecione um unico PDF assinado de ate 10MB e confirme o envio.';
  }

  if (hasAny(normalized, ['tamanho', 'limite', 'quantos mb', '10mb'])) {
    return 'O PDF do pre-projeto deve ter no maximo 10MB e deve reunir os documentos assinados em um unico arquivo.';
  }

  return 'Posso ajudar com envio de pre-projeto, status da submissao, regras do PDF e resumo do arquivo enviado. Reformule sua pergunta dizendo qual dessas partes voce quer consultar.';
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
  userContext.pdf = shouldUsePdf(prompt) ? pdf : null;
  const selectedKnowledge = selectKnowledge(prompt);
  const pdfLines = userContext.pdf
    ? [
        `PDF mais recente: ${userContext.pdf.fileName}.`,
        `Status do processamento do PDF: ${userContext.pdf.processingStatus}.`,
        `Resumo salvo do PDF: ${userContext.pdf.summary || 'sem resumo salvo'}.`,
        `Trecho do texto extraido: ${(userContext.pdf.extractedText || '').slice(0, 12000) || 'sem texto extraido'}.`,
      ].join('\n')
    : 'PDF omitido porque a pergunta nao exige consulta ao arquivo.';
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
              'Use o PDF somente quando a pergunta for sobre resumo, analise, tema, objetivo, metodologia, documento, arquivo ou pre-projeto.',
              'Para perguntas simples sobre identidade, status ou uso do sistema, responda diretamente sem repetir todo o contexto.',
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

    const latestPdf = shouldUsePdf(prompt) ? await getLatestProcessedSubmission(userId) : null;
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
