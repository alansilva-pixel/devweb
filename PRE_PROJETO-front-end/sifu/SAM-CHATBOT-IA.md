# Chatbot SIFU com Cognito Authorizer, IA e historico

Esta etapa altera a rota `POST /chatbot` para:

- exigir token JWT do Cognito via header `Authorization: Bearer TOKEN`;
- responder ao chat usando Bedrock quando disponivel no Learner Lab;
- salvar request e response na tabela DynamoDB `sifu-alana-chat`;
- manter o componente de chat disponivel apenas para usuario logado na aplicacao;
- receber do front-end um bloco `context` com informacoes da interacao atual:
  usuario logado, status mais recente e ultimo arquivo de pre-projeto enviado;
- combinar esse contexto com uma base de conhecimento fixa sobre o SIFU,
  mostrando na resposta quais informacoes vieram da interacao e quais vieram
  do conhecimento previamente disponibilizado ao agente.

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

Para criar esse dominio no API Gateway, a conta precisa ter um certificado ACM
valido em `us-east-1`. Se o certificado existir, rode:

```powershell
sam deploy --parameter-overrides ApiCertificateArn=ARN_DO_CERTIFICADO
```

Sem certificado ACM, use temporariamente o endpoint do output `ChatbotApiUrl` e
configure o CNAME/certificado no painel da disciplina quando estiver disponivel.

## Prints no navegador

1. Abra `https://alanalmeida.sifu5.web.ufersa.dev.br/`.
2. Faca login.
3. Opcionalmente envie um pre-projeto de teste para criar contexto de submissao
   na sessao.
4. Abra DevTools > **Network** > **Fetch/XHR**.
5. Envie uma mensagem no chat, por exemplo:

```text
O que voce sabe sobre minha submissao de TCC?
```

ou:

```text
Quais informacoes voce esta usando da minha interacao e da base do SIFU?
```

6. Clique na chamada `chatbot`.
7. Tire print da aba **Payload** mostrando o JSON enviado. O professor deve ver
   `message` e `context`, incluindo `user` e `submissionSummary`.
8. Tire print da aba **Response** mostrando a resposta da IA. Ela deve citar
   informacoes da interacao, como usuario/status/arquivo, e tambem conhecimento
   previo do SIFU, como PDF unico, limite de 10MB, Cognito, DynamoDB ou Bedrock.

## Teste local com SAM

O arquivo `events/chatbot.json` ja traz um payload de exemplo com contexto.
Depois de configurar as variaveis da funcao, rode:

```powershell
sam local invoke SifuChatbotFunction -e events/chatbot.json
```

Mesmo sem Bedrock disponivel, a resposta de fallback demonstra o requisito: ela
usa o contexto recebido na interacao e a base previamente cadastrada na Lambda.
