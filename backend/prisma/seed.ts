import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'ramonmduarte1@gmail.com';
  const plainPassword = 'arpus.';
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(plainPassword, salt);

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Optionally update the password if it already exists, or just skip
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    console.log(`User ${email} already existed, password was updated.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Ramon Duarte',
      },
    });
    console.log(`User ${email} created successfully.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
