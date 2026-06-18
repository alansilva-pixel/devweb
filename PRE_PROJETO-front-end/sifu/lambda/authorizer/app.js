const crypto = require('crypto');

let cachedKeys = null;
let cacheExpiresAt = 0;

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function getKeys(issuer) {
  if (cachedKeys && cacheExpiresAt > Date.now()) return cachedKeys;

  const response = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!response.ok) throw new Error('Nao foi possivel obter as chaves do Cognito.');

  const body = await response.json();
  cachedKeys = body.keys || [];
  cacheExpiresAt = Date.now() + 60 * 60 * 1000;
  return cachedKeys;
}

async function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('JWT invalido.');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = userPoolId.split('_')[0];
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  if (header.alg !== 'RS256' || payload.iss !== issuer) throw new Error('Emissor do JWT invalido.');
  if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) throw new Error('JWT expirado.');
  if (!['id', 'access'].includes(payload.token_use)) throw new Error('Tipo de JWT invalido.');

  const keys = await getKeys(issuer);
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('Chave do JWT nao encontrada.');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, 'base64url'),
  );

  if (!valid) throw new Error('Assinatura do JWT invalida.');
  return payload;
}

function policy(principalId, effect, resource, claims = {}) {
  const context = {};
  for (const [key, value] of Object.entries(claims)) {
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      context[key] = String(value);
    }
  }

  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}

exports.handler = async (event) => {
  try {
    const authorization = event.headers?.Authorization || event.headers?.authorization || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const claims = await verifyToken(token);
    return policy(String(claims.sub || claims.username), 'Allow', event.methodArn, claims);
  } catch (error) {
    console.warn('Token rejeitado pelo authorizer.', error.message);
    throw new Error('Unauthorized');
  }
};
