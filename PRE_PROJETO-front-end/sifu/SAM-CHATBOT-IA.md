# Chatbot SIFU com Cognito Authorizer, IA e historico

Esta etapa altera a rota `POST /chatbot` para:

- exigir token JWT do Cognito via header `Authorization: Bearer TOKEN`;
- responder ao chat usando Bedrock quando disponivel no Learner Lab;
- salvar request e response na tabela DynamoDB `sifu-alana-chat`;
- manter o componente de chat disponivel apenas para usuario logado na aplicacao.

## Deploy

```powershell
sam validate --lint
sam build
sam deploy
```

## Dominio customizado

O dominio customizado planejado para a API e:

```text
api.alanalmeida.sifu5.web.ufersa.dev.br
```

Para criar esse dominio no API Gateway, a conta precisa ter um certificado ACM valido em `us-east-1`. Se o certificado existir, rode:

```powershell
sam deploy --parameter-overrides ApiCertificateArn=ARN_DO_CERTIFICADO
```

Sem certificado ACM, use temporariamente o endpoint do output `ChatbotApiUrl` e configure o CNAME/certificado no painel da disciplina quando estiver disponivel.

## Prints no navegador

1. Abra `https://alanalmeida.sifu5.web.ufersa.dev.br/`.
2. Faca login.
3. Abra DevTools > **Network** > **Fetch/XHR**.
4. Envie uma mensagem no chat.
5. Clique na chamada `chatbot`.
6. Tire print da aba **Payload** ou **Request** mostrando o JSON enviado.
7. Tire print da aba **Response** mostrando a resposta da IA.
