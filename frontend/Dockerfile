FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src ./src
COPY tailwind.config.ts ./
COPY postcss.config.js ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
