import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword() {
  const email = 'tom@test.com';
  const newPassword = 'password123';
  
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password
    const user = await prisma.users.update({
      where: { email },
      data: { password: hashedPassword }
    });
    
    console.log(`✅ Password reset for ${email}`);
    console.log('   New password: password123');
    
    // Also reset other test accounts
    const testEmails = ['sarah@test.com', 'alex@test.com', 'mike@test.com', 'test@company.com'];
    
    for (const testEmail of testEmails) {
      try {
        await prisma.users.update({
          where: { email: testEmail },
          data: { password: hashedPassword }
        });
        console.log(`✅ Password reset for ${testEmail}`);
      } catch (e) {
        console.log(`⚠️  Skipped ${testEmail} (user may not exist)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();