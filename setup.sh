#!/bin/bash

echo "🚀 Iniciando configuração automática do MandacaruZap..."

# 1. Configuração de Variáveis de Ambiente
echo "📦 1. Configurando variáveis de ambiente..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "📄 Criando .env a partir de .env.example..."
    cp .env.example .env
    echo "⚠️  Lembre-se de editar o arquivo .env com suas credenciais reais (banco de dados, etc) antes de iniciar!"
  else
    echo "⚠️  Arquivo .env.example não encontrado na raiz."
  fi
else
  echo "✅ Arquivo .env já existe."
fi

# 2. Instalação de dependências e build
echo "⚙️  2. Instalando dependências e compilando os serviços..."

# Backend
echo "-> Configurando Backend..."
cd backend
npm install
npx prisma generate
npm run build
cd ..

# Worker
echo "-> Configurando Worker..."
cd worker
npm install
npx prisma generate
npm run build
cd ..

# Frontend
echo "-> Configurando Frontend..."
cd frontend
npm install
npm run build
cd ..

# 3. Configuração do Banco de Dados e Seed
echo "🗄️  3. Configurando Banco de Dados..."
cd backend
echo "-> Sincronizando o esquema do Prisma com o banco de dados..."
npx prisma db push

echo "🌱 -> Executando Seed (se configurado)..."
# Tenta rodar o seed se houver um arquivo ou script configurado, caso não tenha ele não interrompe
npx prisma db seed || echo "ℹ️  Seed ignorado ou não configurado (sem problemas, adicione um seed no package.json do backend se necessário)."
cd ..

# 4. Configuração do PM2
echo "🚀 4. Iniciando serviços com PM2..."

# Verifica se o pm2 está instalado
if ! command -v pm2 &> /dev/null
then
    echo "-> PM2 não encontrado globalmente. Tentando instalar..."
    npm install -g pm2 || sudo npm install -g pm2
fi

echo "-> Iniciando/Atualizando processos no PM2..."
pm2 start ecosystem.config.js

echo "-> Salvando lista do PM2 para reiniciar com o sistema..."
pm2 save

echo "✅ Configuração concluída com sucesso! Para ver os logs, use 'pm2 logs'."
