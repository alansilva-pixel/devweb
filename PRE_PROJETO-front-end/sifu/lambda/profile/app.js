const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});

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
  return event.requestContext?.authorizer?.claims || event.requestContext?.authorizer || {};
}

function getAuthenticatedEmail(event) {
  return String(getClaims(event).email || '').trim().toLowerCase();
}

function parsePhoto(photoBase64 = '') {
  const match = photoBase64.match(/^data:(.+);base64,(.+)$/);

  if (match) {
    return {
      contentType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }

  return {
    contentType: 'application/octet-stream',
    buffer: Buffer.from(photoBase64, 'base64'),
  };
}

function profileFromItem(item = {}) {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, value.S || '']),
  );
}

async function withPhotoUrl(profile) {
  if (!profile.photoBucket || !profile.photoKey) return profile;

  const photoUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: profile.photoBucket,
      Key: profile.photoKey,
    }),
    { expiresIn: 60 * 60 },
  );

  return { ...profile, photoUrl };
}

async function getProfile(event) {
  const email = getAuthenticatedEmail(event);
  if (!email) return response(401, { message: 'Usuario autenticado sem email.' });

  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: process.env.PROFILE_TABLE,
      Key: { email: { S: email } },
    }),
  );

  if (!result.Item) return response(404, { message: 'Perfil ainda nao cadastrado.' });
  return response(200, { profile: await withPhotoUrl(profileFromItem(result.Item)) });
}

async function saveProfile(event) {
  const payload = event.body ? JSON.parse(event.body) : {};
  const email = getAuthenticatedEmail(event);
  const nome = String(payload.nome || '').trim();

  if (!email || !nome) {
    return response(400, { message: 'Informe o nome e utilize uma conta autenticada com email.' });
  }

  const table = process.env.PROFILE_TABLE;
  const bucket = process.env.PROFILE_BUCKET;
  const existing = await dynamodb.send(
    new GetItemCommand({
      TableName: table,
      Key: { email: { S: email } },
    }),
  );
  const currentProfile = profileFromItem(existing.Item);
  let photoBucket = currentProfile.photoBucket || '';
  let photoKey = currentProfile.photoKey || '';

  if (payload.photoBase64) {
    const photo = parsePhoto(payload.photoBase64);
    if (!photo.contentType.startsWith('image/')) {
      return response(400, { message: 'Selecione um arquivo de imagem valido.' });
    }
    if (photo.buffer.length > 5 * 1024 * 1024) {
      return response(400, { message: 'A foto deve ter no maximo 5MB.' });
    }

    const safeEmail = email.replace(/[^a-z0-9@._-]/gi, '_');
    const fileExtension = String(payload.photoFileName || 'perfil.jpg').split('.').pop() || 'jpg';
    photoKey = `profiles/${safeEmail}-${Date.now()}.${fileExtension}`;
    photoBucket = bucket;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: photoKey,
        Body: photo.buffer,
        ContentType: payload.photoContentType || photo.contentType,
      }),
    );
  }

  const profile = {
    email,
    nome,
    matricula: String(payload.matricula || ''),
    curso: String(payload.curso || ''),
    telefone: String(payload.telefone || ''),
    bio: String(payload.bio || ''),
    photoBucket,
    photoKey,
    photoUri: photoBucket && photoKey ? `s3://${photoBucket}/${photoKey}` : '',
    updatedAt: new Date().toISOString(),
  };

  await dynamodb.send(
    new PutItemCommand({
      TableName: table,
      Item: Object.fromEntries(
        Object.entries(profile).map(([key, value]) => [key, { S: value }]),
      ),
    }),
  );

  return response(200, {
    message: 'Perfil atualizado com sucesso.',
    profile: await withPhotoUrl(profile),
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') return getProfile(event);
    if (event.httpMethod === 'PUT') return saveProfile(event);
    return response(405, { message: 'Metodo nao permitido.' });
  } catch (error) {
    console.error(error);
    return response(500, { message: 'Nao foi possivel processar o perfil.' });
  }
};
