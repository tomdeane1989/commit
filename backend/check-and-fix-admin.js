import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndFixAdmin() {
  try {
    // Check current users
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_admin: true
      }
    });

    console.log('Current users:');
    users.forEach(user => {
      console.log(`  ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role}, Admin: ${user.is_admin}`);
    });

    // Find a user to make admin if none exists
    const adminUsers = users.filter(u => u.is_admin);
    
    if (adminUsers.length === 0) {
      console.log('\nNo admin users found. Making first user an admin...');
      
      if (users.length > 0) {
        const firstUser = users[0];
        await prisma.users.update({
          where: { id: firstUser.id },
          data: { is_admin: true }
        });
        console.log(`✅ Made ${firstUser.first_name} ${firstUser.last_name} an admin`);
      } else {
        console.log('No users found at all!');
      }
    } else {
      console.log(`\n✅ Found ${adminUsers.length} admin user(s)`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixAdmin();