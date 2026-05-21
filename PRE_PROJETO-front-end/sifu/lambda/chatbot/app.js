exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const chat = typeof payload.chat === 'string' ? payload.chat.trim() : '';
    const name = chat || 'visitante';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Ol\u00e1, ${name}! Aqui \u00e9 o assistente do SIFU. No que posso ser \u00fatil?`,
      }),
    };
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: 'Envie um JSON v\u00e1lido no formato {"chat":"SEU_NOME"}.',
      }),
    };
  }
};
