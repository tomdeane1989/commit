// Script to update all user passwords to 'test1234' for testing
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function updateAllUserPasswords() {
  console.log('🔐 Updating all user passwords to "test1234"...\n');

  try {
    // Get all users
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true
      }
    });

    console.log(`Found ${users.length} users to update\n`);

    // Hash the password
    const hashedPassword = await bcrypt.hash('test1234', 10);

    // Update each user
    let updated = 0;
    for (const user of users) {
      try {
        await prisma.users.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });
        console.log(`✅ Updated: ${user.email} (${user.first_name} ${user.last_name})`);
        updated++;
      } catch (error) {
        console.error(`❌ Failed to update ${user.email}:`, error.message);
      }
    }

    console.log(`\n✨ Successfully updated ${updated}/${users.length} users`);
    console.log('All users can now login with password: test1234\n');

  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAllUserPasswords();
