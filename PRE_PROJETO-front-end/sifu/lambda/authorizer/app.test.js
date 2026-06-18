const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('./app');

test('autoriza todas as rotas e metodos do mesmo estagio', () => {
  const resource = _test.stageResource(
    'arn:aws:execute-api:us-east-1:123456789012:api-id/Prod/POST/submissions',
  );

  assert.equal(resource, 'arn:aws:execute-api:us-east-1:123456789012:api-id/Prod/*/*');
});
