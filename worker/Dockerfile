FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

# Copia o esquema do prisma de backend para gerar o cliente localmente
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

CMD ["npm", "run", "dev"]
