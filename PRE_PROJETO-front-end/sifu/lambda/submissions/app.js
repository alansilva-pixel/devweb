const crypto = require('crypto');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamodb = new DynamoDBClient({});
const s3 = new S3Client({});
const sqs = new SQSClient({});

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

function getUser(claims, payload = {}) {
  const bodyUser = payload.user && typeof payload.user === 'object' ? payload.user : {};
  const email = String(claims.email || bodyUser.email || '');
  const userId = String(claims.sub || claims['cognito:username'] || email || 'usuario-autenticado');

  return {
    userId,
    email,
    name: String(claims.name || bodyUser.nome || email || 'usuario'),
  };
}

function sanitizeFileName(fileName) {
  return String(fileName || 'pre-projeto.pdf')
    .replace(/[^\w.\- ]+/g, '_')
    .slice(0, 160);
}

async function createSubmission(event) {
  const claims = getClaims(event);
  const payload = event.body ? JSON.parse(event.body) : {};
  const user = getUser(claims, payload);
  const fileName = sanitizeFileName(payload.fileName);
  const contentType = String(payload.contentType || 'application/pdf');
  const fileSize = Number(payload.fileSize || 0);

  if (!fileName.toLowerCase().endsWith('.pdf') || contentType !== 'application/pdf') {
    return response(400, { message: 'Envie um arquivo PDF valido.' });
  }

  if (!fileSize || fileSize > 10 * 1024 * 1024) {
    return response(400, { message: 'O PDF deve ter ate 10MB.' });
  }

  const bucket = process.env.SUBMISSION_BUCKET;
  const table = process.env.SUBMISSIONS_TABLE;
  const submissionId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const s3Key = `submissions/${user.userId}/${submissionId}/${fileName}`;

  await dynamodb.send(
    new PutItemCommand({
      TableName: table,
      Item: {
        userId: { S: user.userId },
        createdAt: { S: createdAt },
        submissionId: { S: submissionId },
        email: { S: user.email },
        name: { S: user.name },
        fileName: { S: fileName },
        fileSize: { N: String(fileSize) },
        bucket: { S: bucket },
        s3Key: { S: s3Key },
        status: { S: 'Aguardando upload' },
        processingStatus: { S: 'pending_upload' },
      },
    }),
  );

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: contentType,
      Metadata: {
        userId: user.userId,
        submissionId,
      },
    }),
    { expiresIn: 300 },
  );

  return response(200, {
    submissionId,
    createdAt,
    fileName,
    uploadUrl,
    s3Key,
    status: 'Aguardando upload',
  });
}

async function completeSubmission(event) {
  const claims = getClaims(event);
  const payload = event.body ? JSON.parse(event.body) : {};
  const user = getUser(claims, payload);
  const submissionId = event.pathParameters?.submissionId;
  const createdAt = String(payload.createdAt || '');

  if (!submissionId || !createdAt) {
    return response(400, { message: 'Informe submissionId e createdAt.' });
  }

  const table = process.env.SUBMISSIONS_TABLE;
  const queueUrl = process.env.PDF_PROCESSING_QUEUE_URL;
  const now = new Date().toISOString();

  await dynamodb.send(
    new UpdateItemCommand({
      TableName: table,
      Key: {
        userId: { S: user.userId },
        createdAt: { S: createdAt },
      },
      UpdateExpression: 'SET #status = :status, processingStatus = :processingStatus, uploadedAt = :uploadedAt',
      ConditionExpression: 'submissionId = :submissionId',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': { S: 'Em analise' },
        ':processingStatus': { S: 'queued' },
        ':uploadedAt': { S: now },
        ':submissionId': { S: submissionId },
      },
    }),
  );

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        userId: user.userId,
        createdAt,
        submissionId,
      }),
    }),
  );

  return response(200, {
    submissionId,
    createdAt,
    status: 'Em analise',
    processingStatus: 'queued',
  });
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const path = event.resource || event.path || '';

    if (method === 'POST' && path === '/submissions') {
      return createSubmission(event);
    }

    if (method === 'POST' && path.includes('/submissions/{submissionId}/complete')) {
      return completeSubmission(event);
    }

    return response(404, { message: 'Rota nao encontrada.' });
  } catch (error) {
    console.error(error);
    return response(500, { message: 'Nao foi possivel processar a submissao.' });
  }
};
