<div align="center">
  <img src="frontend/public/quality-brand.svg" alt="Quality System" width="320" />

  <p><strong>Plataforma web para digitalização e gestão de processos de inspeção da qualidade.</strong></p>

  <p>
    <img alt="Vue.js" src="https://img.shields.io/badge/Vue.js-3-42b883?logo=vuedotjs&logoColor=white" />
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" />
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-18-4169e1?logo=postgresql&logoColor=white" />
    <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white" />
  </p>
</div>

## Sobre o projeto

O **Quality System** é um projeto de portfólio criado para centralizar planos, registros e resultados de inspeções de recebimento e saída. A aplicação transforma controles manuais em um fluxo digital rastreável, com critérios técnicos, níveis de acesso, relatórios e indicadores.

O projeto foi desenvolvido como uma demonstração técnica e não representa um sistema oficial de nenhuma empresa.

## Funcionalidades

- Cadastro, edição, revisão e clonagem de planos de inspeção;
- Inspeções **IQC** e **OQC** com rastreabilidade de lote e nota fiscal;
- Características variáveis, visuais, scanner, testes especiais e **XRF/RoHS**;
- Planos de amostragem fixa ou baseados na **NBR 5426**;
- Critérios de AQL/NQA, nível de inspeção, Ac e Re;
- Cálculo e acompanhamento de **CPK**;
- Regimes de inspeção Normal, Atenuada e Severa;
- Fluxo controlado para sugestão e aprovação de comutação de regime;
- Dashboard com indicadores, filtros e análise de variação;
- Emissão de relatórios técnicos em PDF;
- Gestão de usuários, áreas e níveis de acesso;
- Notificações e registro de eventos relevantes;
- Controle de sessão e encerramento por inatividade;
- Interface responsiva e PWA para computadores e celulares.

## Tecnologias

### Frontend

- Vue 3 e Vite;
- Pinia;
- Chart.js;
- jsPDF e html2pdf.js;
- CSS responsivo e Service Worker.

### Backend

- Node.js;
- Express;
- PostgreSQL;
- JWT e bcrypt;
- APIs REST com autorização por nível de acesso.

### Infraestrutura

- Docker e Docker Compose;
- Nginx como servidor do frontend e proxy reverso;
- Volume persistente para o PostgreSQL.

## Arquitetura

```text
Navegador / PWA
       │
       ▼
Frontend Vue + Nginx :8080
       │
       ▼
Backend Node + Express :3333
       │
       ▼
PostgreSQL :5433 → 5432
```

## Como executar com Docker

### Pré-requisitos

- Git;
- Docker Desktop com Docker Compose.

### 1. Clonar o repositório

```bash
git clone https://github.com/Iuran-Freire/Quality-System-.git
cd Quality-System-
git switch Definitive-QA
```

### 2. Criar o arquivo de ambiente

No PowerShell:

```powershell
Copy-Item .env.docker.example .env.docker
```

No Linux ou macOS:

```bash
cp .env.docker.example .env.docker
```

Edite `.env.docker` e substitua todos os valores de exemplo por segredos próprios. Não publique esse arquivo.

### 3. Construir e iniciar os serviços

```bash
docker compose --env-file .env.docker up -d --build
```

Confira o estado dos contêineres:

```bash
docker compose --env-file .env.docker ps
```

### 4. Criar o primeiro administrador

Em uma nova instalação, execute uma única vez. A senha precisa ter pelo menos 10 caracteres.

No PowerShell:

```powershell
$headers = @{ "x-setup-key" = "SUBSTITUA_PELA_SETUP_KEY" }
$body = @{
  name = "Administrador"
  username = "admin"
  password = "SUBSTITUA_POR_UMA_SENHA_FORTE"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3333/auth/seed-admin" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

### 5. Acessar

- Aplicação: [http://localhost:8080](http://localhost:8080)
- Verificação da API: [http://localhost:3333/health](http://localhost:3333/health)

Use o usuário e a senha definidos na etapa anterior.

### Encerrar os serviços

```bash
docker compose --env-file .env.docker down
```

Os dados permanecem no volume `quality-system-data`. Para evitar perda de dados, não remova o volume sem antes fazer backup.

## Desenvolvimento sem Docker

Crie um banco PostgreSQL e configure as variáveis do backend em `backend/.env`. Depois:

```bash
cd backend
npm install
npm run dev
```

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Por padrão, o frontend de desenvolvimento usa `http://localhost:3333` como endereço da API. Para alterar, defina `VITE_API_URL` em `frontend/.env`.

## Estrutura do projeto

```text
Quality-System-/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── repositories/
│   │   ├── Routes/
│   │   ├── services/
│   │   └── sql/
│   └── Dockerfile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── styles/
│   │   └── utils/
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── .env.docker.example
```

## Segurança

- O repositório não contém credenciais de demonstração ou segredos reais;
- `.env`, `.env.docker` e arquivos equivalentes estão ignorados pelo Git;
- Use valores longos e aleatórios para `JWT_SECRET`, `SETUP_KEY` e `POSTGRES_PASSWORD`;
- Não exponha publicamente as portas `3333` e `5433` em produção;
- Para produção, utilize HTTPS, backups, restrições de rede e um banco gerenciado ou isolado.

## Estado do projeto

Projeto funcional de portfólio. Novas melhorias podem incluir testes automatizados, pipeline de CI/CD, armazenamento externo de anexos e uma estratégia de implantação em nuvem.

## Autor

Desenvolvido por **Iuran Freire** como projeto de portfólio voltado à aplicação de tecnologia em processos de qualidade industrial.

## Uso

Este repositório foi disponibilizado para apresentação e estudo. Nenhuma licença de uso, redistribuição ou exploração comercial foi definida até o momento.
