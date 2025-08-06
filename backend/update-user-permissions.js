import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateUser() {
  await prisma.users.update({
    where: { email: 'test@company.com' },
    data: { is_admin: true, role: 'manager' }
  });
  console.log('Updated test@company.com to have admin privileges');
  await prisma.$disconnect();
}

updateUser();