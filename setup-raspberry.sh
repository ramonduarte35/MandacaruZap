#!/bin/bash

# Interrompe o script se qualquer comando falhar
set -e

echo "=================================================="
echo " Iniciando Instalação do MandacaruZap no Raspberry"
echo "=================================================="

# 1. Atualizar pacotes
echo "Atualizando pacotes do sistema..."
sudo apt-get update

# 2. Instalar dependências básicas
echo "Instalando dependências básicas (curl, gnupg, build-essential)..."
sudo apt-get install -y curl gnupg build-essential

# 3. Instalar Node.js v20 (LTS) se não estiver instalado
echo "Verificando instalação do Node.js..."
if ! command -v node &> /dev/null; then
  echo "Instalando Node.js v20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js já instalado na versão: $(node -v)"
fi

# 4. Instalar Postgresql e Redis
echo "Instalando PostgreSQL e Redis..."
sudo apt-get install -y postgresql redis-server

# 5. Iniciar e habilitar serviços no boot
echo "Iniciando e habilitando serviços do banco de dados e cache..."
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 6. Configurar banco de dados Postgres
echo "Configurando banco de dados PostgreSQL..."
# Define a senha do usuário postgres
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'Mand@c@ruZap#2024!Pg';" || echo "Aviso: Falha ao definir senha do postgres (pode já estar definida)."
# Cria o banco whatsapp_affiliate se não existir
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'whatsapp_affiliate'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE whatsapp_affiliate OWNER postgres;"

# 7. Configurar variáveis de ambiente do projeto (.env)
echo "Configurando arquivos de ambiente .env..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Arquivo .env criado a partir do .env.example."
  else
    echo "Aviso: .env.example não encontrado para criar o .env principal."
  fi
fi

# Garante que os subprojetos tenham seus arquivos .env corretos
if [ ! -f backend/.env ]; then
  cp .env backend/.env 2>/dev/null || true
fi

if [ ! -f worker/.env ]; then
  cp .env worker/.env 2>/dev/null || true
fi

if [ ! -f frontend/.env.local ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:5050" > frontend/.env.local
fi

# 8. Instalar dependências dos serviços
echo "Instalando dependências do backend, worker e frontend..."
npm install --prefix backend
npm install --prefix worker
npm install --prefix frontend

# 9. Executar migrações do Prisma e gerar client
echo "Preparando banco de dados com Prisma..."
npx --prefix backend prisma migrate deploy
npx --prefix backend prisma generate
npx --prefix worker prisma generate

# Executar seed do banco de dados com dados iniciais
echo "Populando banco de dados (seeding)..."
npx --prefix backend ts-node src/seed.ts || echo "Aviso: Seed já executado ou falhou."

# 10. Compilar o projeto (Build)
echo "Compilando backend..."
npm run build --prefix backend

echo "Compilando worker..."
npm run build --prefix worker

echo "Compilando frontend..."
npm run build --prefix frontend

# 11. Instalar PM2 para gerenciamento dos processos em produção
echo "Instalando PM2..."
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

# 12. Iniciar serviços com PM2
echo "Iniciando os serviços no PM2..."
pm2 delete all || true
pm2 start dist/index.js --name "mandacaruzap-backend" --cwd ./backend
pm2 start dist/index.js --name "mandacaruzap-worker" --cwd ./worker
pm2 start "npm start" --name "mandacaruzap-frontend" --cwd ./frontend

# Salvar processos ativos para restaurar no reboot
pm2 save

echo "=================================================="
echo " Instalação concluída com sucesso!"
echo " Serviços em execução no PM2. Use 'pm2 status' para monitorar."
echo " O painel está disponível em: http://localhost:3000"
echo "=================================================="
