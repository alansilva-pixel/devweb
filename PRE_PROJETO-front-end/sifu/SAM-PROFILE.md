# Perfil SIFU com S3, DynamoDB e API Gateway

Esta etapa adiciona:

- Bucket S3: `sifu-alana-2026.1`
- Tabela DynamoDB: `sifu-alana`
- Lambda: `sifu-profile`
- Rota REST API: `PUT /profile`
- Role de execucao da Lambda: `LabRole`

Se precisar trocar `alana` por outro nome, rode o deploy com:

```powershell
sam deploy --parameter-overrides StudentName=seunome
```

## 1. Configurar credenciais do Learner Lab

No Learner Lab, clique em **AWS Details** e copie as credenciais temporarias.

```powershell
aws configure
```

Use:

```text
AWS Access Key ID: cole o AccessKeyId
AWS Secret Access Key: cole o SecretAccessKey
Default region name: us-east-1
Default output format: json
```

Depois configure o token:

```powershell
aws configure set aws_session_token "COLE_AQUI_O_SESSION_TOKEN"
```

Teste:

```powershell
aws sts get-caller-identity
```

## 2. Validar e publicar a infraestrutura

```powershell
sam validate --lint
sam build
sam deploy
```

No final do deploy, confira os outputs:

- `ProfileApiUrl`
- `ProfileBucketName`
- `ProfileTableName`

## 3. Testar a rota PUT /profile pelo terminal

Troque `URL_PROFILE_API` pelo output `ProfileApiUrl`:

```powershell
Invoke-RestMethod -Method Put `
  -Uri "URL_PROFILE_API" `
  -ContentType "application/json" `
  -Body '{
    "nome":"Alana",
    "email":"alana@alunos.ufersa.edu.br",
    "matricula":"2026000000",
    "curso":"Ciência da Computação",
    "telefone":"(84) 99999-9999",
    "bio":"Estudante usando o SIFU.",
    "photoFileName":"perfil.txt",
    "photoContentType":"text/plain",
    "photoBase64":"Zm90byBkZSB0ZXN0ZQ=="
  }'
```

Esse teste cria um arquivo simples no S3 e um item no DynamoDB. Para o print final, prefira usar a tela de perfil com uma imagem real.

## 4. Configurar a tela de perfil do front-end

Crie um arquivo `.env` na raiz do projeto com o output `ProfileApiUrl`:

```text
VITE_PROFILE_API_URL=https://SUA_API.execute-api.us-east-1.amazonaws.com/Prod/profile
```

Depois rode:

```powershell
npm run build
```

Publique o front na URL da atividade:

```text
https://alanalmeida.sifu5.web.ufersa.dev.br/
```

Na aplicacao, acesse o menu **Perfil**, altere os dados e selecione uma foto diferente da foto do OAuth. Clique em **Salvar perfil**.

## 5. Prints para enviar

1. **S3**: abra o bucket `sifu-alana-2026.1` e mostre o arquivo da foto dentro da pasta `profiles/`.
2. **DynamoDB**: abra a tabela `sifu-alana`, clique em **Explore table items** e mostre o item cadastrado.
3. **Navegacao do perfil**: abra a tela **Perfil** no navegador, mostrando os dados cadastrados e o endereco `https://alanalmeida.sifu5.web.ufersa.dev.br/`.
