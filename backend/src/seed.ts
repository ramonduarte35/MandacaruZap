import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Cria usuário Admin
  const email = 'admin@mandacaruzap.com';
  const passwordHash = await bcrypt.hash('admin123', 10);

  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Admin Duarte',
        amazonId: 'ramonamazon-20',
        shopeeId: 'ramonshopee_aff',
        mercadolivreId: 'ramonml_aff',
        mercadolivreChannel: 'ramonduarte',
        mercadolivreTool: '85424440',
        mercadolivreWord: 'ramonduarte'
      }
    });
    console.log(`User created: ${user.email}`);
  } else {
    user = await prisma.user.update({
      where: { email },
      data: {
        mercadolivreChannel: 'ramonduarte',
        mercadolivreTool: '85424440',
        mercadolivreWord: 'ramonduarte'
      }
    });
    console.log(`User updated: ${user.email}`);
  }

  // 2. Cria instância mockada de WhatsApp
  const instanceId = 'whatsapp-mock-id';
  let instance = await prisma.whatsappInstance.findUnique({
    where: { id: instanceId }
  });

  if (!instance) {
    instance = await prisma.whatsappInstance.create({
      data: {
        id: instanceId,
        name: 'Celular Comercial 1',
        phone: '5511999999999',
        status: 'CONNECTED',
        userId: user.id
      }
    });
    console.log(`WhatsApp Instance created: ${instance.name}`);
  }

  // 3. Cria mapeamento de grupos mockado
  const mappingId = 'mapping-mock-id';
  let mapping = await prisma.groupMapping.findUnique({
    where: { id: mappingId }
  });

  if (!mapping) {
    mapping = await prisma.groupMapping.create({
      data: {
        id: mappingId,
        name: 'Amazon Tech -> Grupos Vip',
        sourceGroupId: '120363028329@g.us',
        sourceGroupName: 'Grupo Tech Brasil (Fonte)',
        destGroupIds: '120363029411@g.us,120363029422@g.us',
        isActive: true,
        userId: user.id,
        instanceId: instance.id
      }
    });
    console.log(`Group Mapping created: ${mapping.name}`);
  }

  // 4. Cria logs de demonstração
  const logCount = await prisma.log.count();
  if (logCount === 0) {
    await prisma.log.createMany({
      data: [
        {
          originalUrl: 'https://shopee.com.br/product/123/456',
          convertedUrl: 'https://shopee.com.br/product/123/456?sub_id=ramonshopee_aff&utm_source=whatsapp-bot',
          title: 'Smartphone Android 128GB',
          price: 'R$ 1.299,00',
          imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300',
          status: 'SENT',
          sourceGroup: '120363028329@g.us',
          destGroups: '120363029411@g.us,120363029422@g.us',
          userId: user.id,
          instanceId: instance.id
        },
        {
          originalUrl: 'https://www.amazon.com.br/dp/B0C28M2Y6W',
          convertedUrl: 'https://www.amazon.com.br/dp/B0C28M2Y6W?tag=ramonamazon-20',
          title: 'Fone de Ouvido Bluetooth JBL',
          price: 'R$ 189,90',
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300',
          status: 'SENT',
          sourceGroup: '120363028329@g.us',
          destGroups: '120363029411@g.us,120363029422@g.us',
          userId: user.id,
          instanceId: instance.id
        }
      ]
    });
    console.log('Demo logs generated.');
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
