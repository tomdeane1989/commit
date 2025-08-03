import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixChris() {
  try {
    const tom = await prisma.users.findFirst({
      where: { email: 'tom@test.com' },
      select: { id: true }
    });
    
    await prisma.users.update({
      where: { email: 'egger@test.com' },
      data: { 
        manager_id: tom.id,
        reports_to_id: tom.id 
      }
    });
    
    console.log('Fixed Chris Egger manager assignment');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixChris();