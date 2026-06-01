const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

const s3 = new S3Client({ forcePathStyle: true });
const dynamodb = new DynamoDBClient({});

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};

function response(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
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

exports.handler = async (event) => {
  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const email = String(payload.email || '').trim().toLowerCase();
    const nome = String(payload.nome || '').trim();

    if (!email || !nome) {
      return response(400, {
        message: 'Informe pelo menos nome e email do usuário.',
      });
    }

    if (!payload.photoBase64) {
      return response(400, {
        message: 'Envie a foto do perfil no campo photoBase64.',
      });
    }

    const bucket = process.env.PROFILE_BUCKET;
    const table = process.env.PROFILE_TABLE;
    const now = new Date().toISOString();
    const safeEmail = email.replace(/[^a-z0-9@._-]/gi, '_');
    const fileExtension = String(payload.photoFileName || 'perfil.jpg').split('.').pop() || 'jpg';
    const s3Key = `profiles/${safeEmail}-${Date.now()}.${fileExtension}`;
    const photo = parsePhoto(payload.photoBase64);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: photo.buffer,
        ContentType: payload.photoContentType || photo.contentType,
      }),
    );

    const profile = {
      email,
      nome,
      matricula: String(payload.matricula || ''),
      curso: String(payload.curso || ''),
      telefone: String(payload.telefone || ''),
      bio: String(payload.bio || ''),
      photoBucket: bucket,
      photoKey: s3Key,
      photoUri: `s3://${bucket}/${s3Key}`,
      updatedAt: now,
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
      profile,
    });
  } catch (error) {
    console.error(error);
    return response(500, {
      message: 'Não foi possível atualizar o perfil.',
    });
  }
};
