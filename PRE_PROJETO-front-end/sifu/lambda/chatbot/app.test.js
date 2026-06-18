const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('./app');

test('preserva um identificador de conversa valido', () => {
  assert.equal(_test.getConversationId({ conversationId: 'conversation_123' }), 'conversation_123');
});

test('substitui um identificador de conversa inseguro', () => {
  const conversationId = _test.getConversationId({ conversationId: '../../invalido' });
  assert.match(conversationId, /^[0-9a-f-]{36}$/);
});

test('ativa analise academica para perguntas sobre metodologia', () => {
  assert.equal(_test.shouldUsePdf('Analise a metodologia do meu projeto'), true);
  assert.equal(_test.academicInstructions('Analise a metodologia').length, 3);
});

test('nao consulta PDF para uma pergunta simples de status', () => {
  assert.equal(_test.shouldUsePdf('Qual e o meu status?'), false);
  assert.deepEqual(_test.academicInstructions('Qual e o meu status?'), []);
});
