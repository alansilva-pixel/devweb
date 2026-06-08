const crypto = require('crypto');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const dynamodb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

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

function fallbackAnswer(prompt, name) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes('prazo') || normalized.includes('data')) {
    return `Olá, ${name}! Posso te ajudar a conferir prazos do SIFU. Informe o edital, curso ou etapa que você quer acompanhar.`;
  }

  if (normalized.includes('tcc') || normalized.includes('projeto')) {
    return `Olá, ${name}! Para assuntos de TCC, posso orientar sobre envio de pré-projeto, situação da submissão e documentos necessários.`;
  }

  return `Olá, ${name}! Aqui é o assistente de IA do SIFU. Recebi sua mensagem: "${prompt}". No que posso ser útil?`;
}

async function askAi(prompt, name) {
  const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';
  const body = {
    messages: [
      {
        role: 'user',
        content: [
          {
            text: `Você é o assistente do SIFU, sistema acadêmico da UFERSA. Responda em português, de forma curta e útil. Usuário: ${name}. Mensagem: ${prompt}`,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 220,
      temperature: 0.4,
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
    return decoded.output?.message?.content?.[0]?.text || fallbackAnswer(prompt, name);
  } catch (error) {
    console.warn('Bedrock indisponivel no laboratorio, usando fallback do assistente.', error.name);
    return fallbackAnswer(prompt, name);
  }
}

async function saveChat({ userId, email, name, prompt, answer, aiProvider }) {
  const tableName = process.env.CHAT_MESSAGES_TABLE;
  if (!tableName) return;

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
        response: { S: answer },
        aiProvider: { S: aiProvider },
      },
    }),
  );
}

exports.handler = async (event) => {
  try {
    const claims = getClaims(event);
    const userId = String(claims.sub || claims['cognito:username'] || 'usuario-autenticado');
    const email = String(claims.email || '');
    const name = String(claims.name || email || 'usuário');
    const payload = event.body ? JSON.parse(event.body) : {};
    const prompt = getPrompt(payload);

    if (!prompt) {
      return response(400, {
        message: 'Envie um JSON no formato {"message":"sua pergunta"}.',
      });
    }

    const answer = await askAi(prompt, name);

    await saveChat({
      userId,
      email,
      name,
      prompt,
      answer,
      aiProvider: process.env.BEDROCK_MODEL_ID || 'fallback',
    });

    return response(200, {
      message: answer,
      request: {
        message: prompt,
      },
      ai: {
        provider: process.env.BEDROCK_MODEL_ID || 'fallback',
      },
    });
  } catch (error) {
    console.error(error);
    return response(500, {
      message: 'Não foi possível processar a mensagem do chat.',
    });
  }
};
