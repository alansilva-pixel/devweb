const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const pdf = require('pdf-parse');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = new DynamoDBClient({});
const s3 = new S3Client({});

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function localSummary(text) {
  if (!text) {
    return 'Nao foi possivel extrair texto do PDF. O arquivo pode estar escaneado como imagem.';
  }

  const firstChunk = text.slice(0, 1200);
  return `Resumo preliminar automatico: ${firstChunk}${text.length > firstChunk.length ? '...' : ''}`;
}

async function summarizeWithBedrock(text, metadata) {
  const normalized = normalizeText(text);
  if (!normalized) return localSummary('');

  const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';
  const sourceText = normalized.slice(0, 18000);
  const body = {
    messages: [
      {
        role: 'user',
        content: [
          {
            text: [
              'Voce e um assistente academico da UFERSA.',
              'Resuma o pre-projeto de TCC abaixo em portugues claro.',
              'Inclua: tema, problema/objetivo, metodologia, principais entregas e pontos que merecem atencao.',
              'Nao invente informacoes ausentes no texto.',
              `Arquivo: ${metadata.fileName || 'pre-projeto.pdf'}`,
              `Texto extraido: ${sourceText}`,
            ].join('\n\n'),
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 700,
      temperature: 0.2,
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
    return decoded.output?.message?.content?.[0]?.text || localSummary(normalized);
  } catch (error) {
    console.warn('Bedrock indisponivel para resumir PDF, usando resumo local.', error.name);
    return localSummary(normalized);
  }
}

async function markFailed(table, userId, createdAt, message) {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: table,
      Key: {
        userId: { S: userId },
        createdAt: { S: createdAt },
      },
      UpdateExpression: 'SET processingStatus = :processingStatus, processingError = :processingError, processedAt = :processedAt',
      ConditionExpression: 'attribute_not_exists(extractedText)',
      ExpressionAttributeValues: {
        ':processingStatus': { S: 'failed' },
        ':processingError': { S: message },
        ':processedAt': { S: new Date().toISOString() },
      },
    }),
  );
}

async function processSubmission(message) {
  const table = process.env.SUBMISSIONS_TABLE;
  const { userId, createdAt, submissionId } = JSON.parse(message.body);

  const record = await dynamodb.send(
    new GetItemCommand({
      TableName: table,
      Key: {
        userId: { S: userId },
        createdAt: { S: createdAt },
      },
    }),
  );

  const item = record.Item;
  if (!item || item.submissionId?.S !== submissionId) {
    throw new Error('Submissao nao encontrada para processamento.');
  }

  const bucket = item.bucket.S;
  const s3Key = item.s3Key.S;
  const fileName = item.fileName?.S || 'pre-projeto.pdf';

  await dynamodb.send(
    new UpdateItemCommand({
      TableName: table,
      Key: {
        userId: { S: userId },
        createdAt: { S: createdAt },
      },
      UpdateExpression: 'SET processingStatus = :processingStatus',
      ExpressionAttributeValues: {
        ':processingStatus': { S: 'processing' },
      },
    }),
  );

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
  const buffer = await streamToBuffer(object.Body);
  const parsed = await pdf(buffer);
  const extractedText = normalizeText(parsed.text);
  const storedText = extractedText.slice(0, 120000);
  const summary = await summarizeWithBedrock(extractedText, { fileName });
  const now = new Date().toISOString();

  await dynamodb.send(
    new UpdateItemCommand({
      TableName: table,
      Key: {
        userId: { S: userId },
        createdAt: { S: createdAt },
      },
      UpdateExpression:
        'SET processingStatus = :processingStatus, processedAt = :processedAt, extractedText = :extractedText, pdfSummary = :pdfSummary, pageCount = :pageCount REMOVE processingError',
      ExpressionAttributeValues: {
        ':processingStatus': { S: extractedText ? 'ready' : 'empty_text' },
        ':processedAt': { S: now },
        ':extractedText': { S: storedText || 'Texto nao extraido.' },
        ':pdfSummary': { S: summary },
        ':pageCount': { N: String(parsed.numpages || 0) },
      },
    }),
  );
}

exports.handler = async (event) => {
  for (const record of event.Records || []) {
    try {
      await processSubmission(record);
    } catch (error) {
      console.error(error);
      try {
        const { userId, createdAt } = JSON.parse(record.body);
        await markFailed(process.env.SUBMISSIONS_TABLE, userId, createdAt, error.message || 'Erro no processamento.');
      } catch (markError) {
        console.error(markError);
      }
      throw error;
    }
  }
};
