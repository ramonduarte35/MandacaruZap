import prisma from './lib/prisma.js';

async function check() {
  console.log("=== GROUP MAPPINGS ===");
  const mappings = await prisma.groupMapping.findMany({
    include: { user: true }
  });
  console.log(JSON.stringify(mappings, null, 2));

  console.log("\n=== LAST 5 LOGS ===");
  const logs = await prisma.log.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(logs, null, 2));
}

check().catch(console.error);
