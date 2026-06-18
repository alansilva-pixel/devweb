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

test('reconhece quantidade de linhas solicitada', () => {
  assert.deepEqual(_test.requestedFormat('Resuma meu pre-projeto em 10 linhas'), {
    lines: 10,
    words: null,
    bullets: false,
  });
});

test('fallback respeita resumo em dez linhas', () => {
  const answer = _test.answerFromPdf('Resuma meu pre-projeto em 10 linhas', {
    fileName: 'projeto.pdf',
    extractedText:
      'Este trabalho investiga sistemas academicos inteligentes. O problema envolve demora na avaliacao documental. ' +
      'O objetivo e apoiar estudantes e professores. A metodologia utiliza desenvolvimento web, processamento de PDF e testes. ' +
      'O sistema armazena arquivos com seguranca. O chatbot consulta os dados enviados. Os resultados serao avaliados por usuarios.',
  });
  const numberedLines = answer.split('\n').filter((line) => /^\d+\./.test(line));
  assert.equal(numberedLines.length, 10);
});

test('fallback seleciona trecho relacionado a metodologia', () => {
  const answer = _test.answerFromPdf('Qual metodologia foi utilizada?', {
    fileName: 'projeto.pdf',
    extractedText:
      'O tema do projeto e educacao digital. A metodologia utiliza pesquisa aplicada, desenvolvimento incremental e testes com usuarios. O cronograma possui quatro etapas.',
  });
  assert.match(answer, /metodologia utiliza pesquisa aplicada/i);
});
