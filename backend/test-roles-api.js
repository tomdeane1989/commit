import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRolesAPI() {
  try {
    console.log('Testing roles API...');
    
    // Get user
    const user = await prisma.users.findUnique({
      where: { email: 'tom@test.com' }
    });
    
    console.log('User found:', {
      email: user?.email,
      company_id: user?.company_id,
      is_manager: user?.is_manager,
      is_admin: user?.is_admin
    });

    // Get roles for the company
    const roles = await prisma.company_roles.findMany({
      where: { company_id: user.company_id },
      orderBy: [
        { is_default: 'desc' },
        { role_name: 'asc' }
      ]
    });

    console.log('Roles found:', roles);
    console.log('Number of roles:', roles.length);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRolesAPI();