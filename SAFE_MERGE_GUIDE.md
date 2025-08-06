# Safe Merge Guide: centralized-permissions → main

## Pre-Merge Checklist

### 1. Code Review
- [ ] Review all 37 changed files
- [ ] Verify no hardcoded test data
- [ ] Check for console.logs to remove
- [ ] Ensure error handling is comprehensive
- [ ] Verify rollback migrations exist

### 2. Testing on Feature Branch
```bash
# Pull latest changes
git checkout feature/centralized-permissions
git pull origin feature/centralized-permissions

# Run tests (if available)
cd backend
npm test

cd ../frontend
npm test
```

### 3. Create Testing Database
```bash
# Create test database with production data copy
pg_dump sales_commission_db > prod_backup.sql
createdb sales_commission_test_db
psql -d sales_commission_test_db < prod_backup.sql

# Update .env to point to test database
# DATABASE_URL="postgresql://localhost:5432/sales_commission_test_db"
```

## Safe Merge Process

### Step 1: Create Integration Branch
```bash
# Create a new integration branch
git checkout main
git pull origin main
git checkout -b integration/centralized-permissions-merge

# Merge feature branch
git merge feature/centralized-permissions

# Resolve any conflicts carefully
```

### Step 2: Test Migrations Locally
```bash
cd backend

# First, check current migration status
npx prisma migrate status

# Create backup
node backup-database.js

# Deploy migrations (not reset!)
npx prisma migrate deploy

# Verify new tables exist
psql -d sales_commission_test_db -c "\d teams"
psql -d sales_commission_test_db -c "\d team_members"
psql -d sales_commission_test_db -c "\d targets" | grep team_id
```

### Step 3: Data Verification Script
Create `verify-migration.js`:
```javascript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('🔍 Verifying migration success...\n');
  
  try {
    // Check tables exist
    const teams = await prisma.teams.count();
    console.log(`✅ Teams table exists with ${teams} records`);
    
    const teamMembers = await prisma.team_members.count();
    console.log(`✅ Team members table exists with ${teamMembers} records`);
    
    // Check targets table has team_id
    const targetWithTeam = await prisma.targets.findFirst({
      where: { team_id: { not: null } }
    });
    console.log(`✅ Targets table has team_id field`);
    
    // Check existing users still work
    const users = await prisma.users.count();
    console.log(`✅ Users table intact with ${users} users`);
    
    // Test permission functions
    const adminUser = await prisma.users.findFirst({
      where: { is_admin: true }
    });
    console.log(`✅ Admin users accessible`);
    
    console.log('\n✨ All verification checks passed!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
```

### Step 4: Test Critical Flows
1. **Authentication**
   ```bash
   # Start the backend
   cd backend
   PORT=3002 node server-working.js
   
   # Test login
   curl -X POST http://localhost:3002/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@company.com","password":"password123"}'
   ```

2. **Permission Checks**
   - Login as admin - verify full access
   - Login as manager - verify team access
   - Login as sales rep - verify limited access

3. **Team Operations**
   - Create a team
   - Add members to team
   - Create team-based quota

### Step 5: Frontend-Backend Integration Test
```bash
# Start both services
cd backend && npm run dev &
cd frontend && npm run dev

# Test through UI:
# 1. Login
# 2. Navigate to Teams page
# 3. Create a team
# 4. Edit team member
# 5. Create team quota
```

## Production Deployment Plan

### Option 1: Staged Deployment (Recommended)

#### Stage 1: Database Only
1. Backup production database
2. Run migrations on production
3. Verify migrations succeeded
4. No code deployed yet - existing app still works

#### Stage 2: Backend with Feature Flag
1. Add environment variable: `ENABLE_TEAMS=false`
2. Deploy backend code
3. Existing functionality continues working
4. New team routes return 404 when disabled

#### Stage 3: Enable Features
1. Set `ENABLE_TEAMS=true`
2. Deploy frontend
3. Monitor logs closely
4. Ready to flip flag back if issues

### Option 2: Blue-Green Deployment

1. **Setup Parallel Environment**
   ```bash
   # Create new database
   pg_dump sales_commission_db > backup.sql
   createdb sales_commission_db_new
   psql -d sales_commission_db_new < backup.sql
   
   # Run migrations on new DB
   DATABASE_URL="postgresql://localhost:5432/sales_commission_db_new" \
     npx prisma migrate deploy
   ```

2. **Deploy to Parallel Environment**
   - Deploy backend to new instance
   - Deploy frontend to new instance
   - Full testing on parallel environment

3. **Switch Traffic**
   - Update load balancer
   - Monitor closely
   - Keep old environment running

### Monitoring Points

1. **Error Tracking**
   ```javascript
   // Add to server-working.js
   app.use((err, req, res, next) => {
     console.error('ERROR:', {
       error: err.message,
       stack: err.stack,
       url: req.url,
       user: req.user?.email
     });
     // Send to monitoring service
   });
   ```

2. **Performance Metrics**
   - Response times for /api/team endpoint
   - Database query times
   - Memory usage

3. **User Activity**
   - Track team creation
   - Monitor permission denials
   - Watch for unusual patterns

## Emergency Procedures

### If Deployment Fails

1. **Immediate Response**
   ```bash
   # Stop services
   pm2 stop all
   
   # Restore database
   psql -d sales_commission_db < backup_[timestamp].sql
   
   # Deploy previous version
   git checkout main
   npm install
   pm2 start all
   ```

2. **Communication**
   - Notify team immediately
   - Update status page
   - Prepare incident report

### Hotfix Procedure
If minor issues found post-deployment:

```bash
# Create hotfix branch
git checkout -b hotfix/team-permissions-issue
# Make fixes
git add .
git commit -m "Fix: [specific issue]"
# Deploy hotfix
```

## Success Criteria

✅ All users can login
✅ Existing permissions work correctly  
✅ Teams page accessible to managers/admins
✅ Team creation successful
✅ Team-based quotas can be created
✅ No errors in logs for 1 hour
✅ Performance metrics stable

## Post-Merge Tasks

1. **Documentation**
   - Update API documentation
   - Create team management guide
   - Update permission matrix

2. **Training**
   - Prepare training materials
   - Schedule team admin training
   - Create video walkthrough

3. **Cleanup**
   - Remove test databases
   - Archive backup files
   - Close related tickets

## Timeline

- **Day 1**: Code review & testing
- **Day 2**: Staging deployment & verification  
- **Day 3**: Production database migration (off-hours)
- **Day 4**: Production code deployment
- **Day 5**: Monitoring & optimization

## Contact Points

- **Technical Lead**: Deployment decisions
- **DevOps**: Infrastructure changes
- **Support Team**: User issues
- **Product Owner**: Feature verification

Remember: **When in doubt, don't deploy.** It's better to delay than to break production.