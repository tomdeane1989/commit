import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.users.findMany({
    where: { email: { contains: '@test' } },
    select: { 
      email: true, 
      password: true,
      is_admin: true,
      company: { select: { name: true } } 
    }
  });
  
  console.log('Test users:', users);
  await prisma.$disconnect();
}

checkUsers();