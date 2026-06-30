import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  const name = process.env.SEED_NAME || 'Admin';

  if (!email || !password) {
    console.error('[Seed] ERRO: SEED_EMAIL e SEED_PASSWORD devem estar definidos no .env');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const user = await prisma.user.create({
      data: { email, passwordHash, name }
    });
    console.log(`[Seed] Usuário criado: ${user.email}`);
  } else {
    console.log(`[Seed] Usuário já existe: ${existing.email} — senha não foi alterada.`);
  }

  console.log('[Seed] Concluído.');
}

main()
  .catch((e) => {
    console.error('[Seed] Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
