# Chatbot SIFU com AWS SAM

Esta pasta ja contem o template SAM da atividade:

- Lambda: `sifu-chatbot`
- Rota REST API: `POST /chatbot`
- Role de execucao: `LabRole`
- Entrada esperada: `{ "chat": "SEU_NOME" }`
- Resposta esperada: `{ "message": "Olá, SEU_NOME! Aqui é o assistente do SIFU. No que posso ser útil?" }`

## 1. Configurar credenciais do Learner Lab

No AWS Academy Learner Lab, clique em **AWS Details** e copie as credenciais temporarias. Depois rode no terminal:

```powershell
aws configure
```

Preencha:

```text
AWS Access Key ID: cole o AccessKeyId do laboratorio
AWS Secret Access Key: cole o SecretAccessKey do laboratorio
Default region name: us-east-1
Default output format: json
```

Como o Learner Lab tambem fornece `AWS_SESSION_TOKEN`, configure o token:

```powershell
aws configure set aws_session_token "COLE_AQUI_O_SESSION_TOKEN"
```

Confirme que o terminal esta autenticado:

```powershell
aws sts get-caller-identity
```

## 2. Testar localmente

```powershell
sam build
sam local invoke SifuChatbotFunction --event events/chatbot.json
```

## 3. Implantar

O projeto ja vem com `samconfig.toml`, entao use:

```powershell
sam deploy
```

Se o seu laboratorio estiver em outra regiao, atualize `region` no `samconfig.toml` antes do deploy.

Caso prefira reconfigurar interativamente, use:

```powershell
sam deploy --guided
```

Sugestao de respostas para o modo guiado:

```text
Stack Name: sifu-chatbot
AWS Region: us-east-1
Confirm changes before deploy: Y
Allow SAM CLI IAM role creation: N
Disable rollback: N
SifuChatbotFunction has no authentication. Is this okay?: Y
Save arguments to configuration file: Y
SAM configuration file: samconfig.toml
SAM configuration environment: default
```

Ao final, tire print do deploy bem sucedido mostrando os outputs, principalmente `ChatbotApiUrl`.

## 4. Invocar a URL

Troque `URL_DO_OUTPUT` pela URL exibida no output `ChatbotApiUrl`:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "URL_DO_OUTPUT" `
  -ContentType "application/json" `
  -Body '{"chat":"SEU_NOME"}'
```

Ou usando curl:

```powershell
curl.exe -X POST "URL_DO_OUTPUT" -H "Content-Type: application/json" -d "{\"chat\":\"SEU_NOME\"}"
```

Tire print mostrando a chamada POST e a resposta da Lambda.
