// Quick script to delete a user
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUser(email) {
  try {
    // Find user and their company
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true }
    });

    if (!user) {
      console.log(`❌ User ${email} not found`);
      return;
    }

    console.log(`Found user: ${user.first_name} ${user.last_name} (${user.email})`);
    console.log(`Company: ${user.company.name}`);

    // Delete user (cascade will handle related records)
    await prisma.users.delete({
      where: { email: email.toLowerCase() }
    });

    console.log(`✅ Deleted user ${email}`);

    // Check if company has other users
    const remainingUsers = await prisma.users.count({
      where: { company_id: user.company_id }
    });

    if (remainingUsers === 0) {
      console.log(`⚠️  Company "${user.company.name}" has no remaining users`);
      console.log(`Deleting company...`);
      await prisma.companies.delete({
        where: { id: user.company_id }
      });
      console.log(`✅ Deleted company`);
    }

  } catch (error) {
    console.error('Error deleting user:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: node delete-user.js <email>');
  process.exit(1);
}

deleteUser(email);
