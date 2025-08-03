import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedUserManagement() {
  console.log('🌱 SEEDING USER MANAGEMENT SYSTEM');
  console.log('='.repeat(50));

  try {
    // Get the test company (or first company if Test Company doesn't exist)
    let testCompany = await prisma.companies.findFirst({
      where: { name: 'Test Company' }
    });

    if (!testCompany) {
      console.log('Test Company not found, using first available company...');
      testCompany = await prisma.companies.findFirst();
    }

    if (!testCompany) {
      throw new Error('No companies found. Please run main seed first.');
    }

    // Get an admin user to attribute the seeding to
    let adminUser = await prisma.users.findFirst({
      where: { 
        company_id: testCompany.id,
        is_admin: true 
      }
    });

    if (!adminUser) {
      console.log('No admin user found for this company. Looking for any admin user...');
      adminUser = await prisma.users.findFirst({
        where: { is_admin: true }
      });
      
      if (!adminUser) {
        throw new Error('No admin user found. Please ensure at least one admin exists.');
      }
      
      // Use the admin user we found and update testCompany to their company
      testCompany = await prisma.companies.findUnique({
        where: { id: adminUser.company_id }
      });
      
      console.log(`Using admin user from ${testCompany.name}`);
    }

    console.log(`📋 Seeding for company: ${testCompany.name}`);
    console.log(`👤 Using admin: ${adminUser.first_name} ${adminUser.last_name}`);

    // 1. Seed Default Company Roles
    console.log('\n🎭 Creating default company roles...');
    
    const defaultRoles = [
      { role_name: 'New Sales', description: 'Responsible for acquiring new customers and closing new business deals' },
      { role_name: 'Account Management', description: 'Manages existing customer relationships and drives expansion revenue' },
      { role_name: 'Sales Development', description: 'Generates and qualifies leads for the sales team' },
      { role_name: 'Customer Success', description: 'Ensures customer satisfaction and drives retention' },
      { role_name: 'Team Lead', description: 'Manages and coaches sales team members' },
      { role_name: 'Regional Lead', description: 'Oversees sales operations across multiple territories' }
    ];

    for (const roleData of defaultRoles) {
      const existingRole = await prisma.company_roles.findFirst({
        where: {
          company_id: testCompany.id,
          role_name: roleData.role_name
        }
      });

      if (!existingRole) {
        await prisma.company_roles.create({
          data: {
            ...roleData,
            is_default: true,
            company_id: testCompany.id,
            created_by_admin_id: adminUser.id
          }
        });
        console.log(`  ✅ Created role: ${roleData.role_name}`);
      } else {
        console.log(`  ⏭️  Role already exists: ${roleData.role_name}`);
      }
    }

    // 2. Seed Default Company Sub-roles
    console.log('\n🏷️  Creating default company sub-roles...');
    
    const defaultSubRoles = [
      // Geographic
      { sub_role_name: 'UK', description: 'United Kingdom territory' },
      { sub_role_name: 'EU', description: 'European Union territory' },
      { sub_role_name: 'US East', description: 'United States East Coast territory' },
      { sub_role_name: 'US West', description: 'United States West Coast territory' },
      { sub_role_name: 'APAC', description: 'Asia-Pacific territory' },
      // Market Segments
      { sub_role_name: 'Enterprise', description: 'Large enterprise accounts (1000+ employees)' },
      { sub_role_name: 'Mid-market', description: 'Mid-market accounts (100-1000 employees)' },
      { sub_role_name: 'SMB', description: 'Small and medium business accounts (<100 employees)' },
      // Product Lines
      { sub_role_name: 'SaaS Products', description: 'Software as a Service product line' },
      { sub_role_name: 'Professional Services', description: 'Consulting and implementation services' },
      { sub_role_name: 'Support & Training', description: 'Customer support and training services' }
    ];

    for (const subRoleData of defaultSubRoles) {
      const existingSubRole = await prisma.company_sub_roles.findFirst({
        where: {
          company_id: testCompany.id,
          sub_role_name: subRoleData.sub_role_name
        }
      });

      if (!existingSubRole) {
        await prisma.company_sub_roles.create({
          data: {
            ...subRoleData,
            is_default: true,
            company_id: testCompany.id,
            created_by_admin_id: adminUser.id
          }
        });
        console.log(`  ✅ Created sub-role: ${subRoleData.sub_role_name}`);
      } else {
        console.log(`  ⏭️  Sub-role already exists: ${subRoleData.sub_role_name}`);
      }
    }

    // 3. Update existing users with new role structure
    console.log('\n👥 Updating existing users...');
    
    const users = await prisma.users.findMany({
      where: { company_id: testCompany.id }
    });

    for (const user of users) {
      let newRole = user.role;
      let newSubRole = user.sub_role;

      // Convert old role system to new flexible system
      if (user.role === 'sales_rep') {
        newRole = 'New Sales';
        newSubRole = user.territory || 'UK'; // Use territory as sub_role
      } else if (user.role === 'manager') {
        newRole = 'Team Lead';
        newSubRole = user.territory || 'UK';
      }

      // Update user with new role structure
      await prisma.users.update({
        where: { id: user.id },
        data: {
          role: newRole,
          sub_role: newSubRole,
          reports_to_id: user.manager_id // Copy manager_id to reports_to_id
        }
      });

      console.log(`  ✅ Updated ${user.first_name} ${user.last_name}: ${newRole}${newSubRole ? ` → ${newSubRole}` : ''}`);
    }

    // 4. Create a sample team
    console.log('\n🏢 Creating sample team...');
    
    const teamLead = await prisma.users.findFirst({
      where: { 
        company_id: testCompany.id,
        role: 'Team Lead'
      }
    });

    if (teamLead) {
      const existingTeam = await prisma.teams.findFirst({
        where: {
          company_id: testCompany.id,
          team_name: 'UK New Sales Team'
        }
      });

      if (!existingTeam) {
        const newTeam = await prisma.teams.create({
          data: {
            team_name: 'UK New Sales Team',
            description: 'Team focused on new business acquisition in the UK market',
            team_lead_id: teamLead.id,
            default_role: 'New Sales',
            default_sub_role: 'UK',
            company_id: testCompany.id,
            created_by_admin_id: adminUser.id
          }
        });

        // Add some team members
        const salesReps = await prisma.users.findMany({
          where: { 
            company_id: testCompany.id,
            role: 'New Sales',
            id: { not: teamLead.id }
          },
          take: 3
        });

        for (const rep of salesReps) {
          await prisma.team_members.create({
            data: {
              team_id: newTeam.id,
              user_id: rep.id,
              added_by_admin_id: adminUser.id
            }
          });
          console.log(`  👤 Added ${rep.first_name} ${rep.last_name} to UK New Sales Team`);
        }

        console.log(`  ✅ Created team: UK New Sales Team (Lead: ${teamLead.first_name} ${teamLead.last_name})`);
      } else {
        console.log(`  ⏭️  Team already exists: UK New Sales Team`);
      }
    }

    // 5. Summary
    console.log('\n📊 USER MANAGEMENT SEEDING SUMMARY');
    console.log('='.repeat(50));
    
    const roleCount = await prisma.company_roles.count({
      where: { company_id: testCompany.id }
    });
    
    const subRoleCount = await prisma.company_sub_roles.count({
      where: { company_id: testCompany.id }
    });
    
    const teamCount = await prisma.teams.count({
      where: { company_id: testCompany.id }
    });
    
    const userCount = await prisma.users.count({
      where: { company_id: testCompany.id }
    });

    console.log(`✅ Company Roles: ${roleCount}`);
    console.log(`✅ Company Sub-roles: ${subRoleCount}`);
    console.log(`✅ Teams: ${teamCount}`);
    console.log(`✅ Users Updated: ${userCount}`);
    console.log('\n🎉 USER MANAGEMENT SYSTEM SEEDED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Error seeding user management system:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedUserManagement().catch(console.error);