# Sales Commission SaaS - Claude Code Development Context

## ⚠️ **CRITICAL INSTRUCTIONS FOR CLAUDE**
1. **NEVER run `prisma migrate reset` or any command that deletes data without explicit permission**
2. **ALWAYS check for existing data before seeding**
3. **NEVER use `seed-data.js` directly - use `seed-data-safe.js`**
4. **ALWAYS create backups before migrations**
5. **NEVER delete user data without explicit confirmation**

## 🏢 **Project Overview**
**Name**: Sales Commission SaaS  
**Purpose**: Sales pipeline and commission tracking solution for small to medium B2B companies
**Core Value**: Simple pipeline clarity for sales reps, outcome forecasting for management  
**Key Principle**: NOT a CRM - focuses purely on commission tracking and pipeline commitment. Integration for CRM data is fundamental.

**Target Users**: UK SMBs with 5-50 sales reps using Salesforce, HubSpot, or Pipedrive

## 🎯 **Current Working State (Production Ready)**

### **✅ What's Working Right Now**
- **Authentication**: JWT-based login with localStorage (test@company.com / password123)
- **Dashboard**: Live data from PostgreSQL with modern gradient UI
- **Deal Management**: 5-column drag-and-drop categorization (Pipeline → Commit → Best Case → Closed Won)
- **Team Management**: Role-based access with admin permissions
- **Target Management**: Quota planning wizard with UK fiscal year support
- **Commission System**: Deal-based commission tracking with automatic calculation on deal closure
- **CRM Integration**: Google Sheets integration with Deal ID support
- **Database**: PostgreSQL with Prisma ORM, fully seeded with test data
- **Deployment**: Live on Vercel (frontend) + Render (backend)

### **🚀 Live URLs**
- **Production**: https://sales-commission-saas.vercel.app/
- **Backend API**: https://sales-commission-backend-latest.onrender.com

## 🏗️ **Technical Stack & Architecture**

### **Frontend** (Next.js - Pages Router)
- **Framework**: Next.js 15.4.1 with Pages Router (NOT App Router)
- **Styling**: Tailwind CSS v3.4.0 
- **State Management**: TanStack React Query + React Context
- **Icons**: Lucide React
- **Location**: `/frontend/` directory

### **Backend** (Node.js/Express)
- **Framework**: Express 4.18.2 (NOT 5.x - causes route parsing issues)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens with localStorage
- **API**: RESTful endpoints with comprehensive validation
- **Location**: `/backend/` directory

### **Database** (PostgreSQL)
- **Local**: `postgresql://username@localhost:5432/sales_commission_db`
- **Production**: Render PostgreSQL (managed via environment variables)
- **ORM**: Prisma with comprehensive schema
- **Seed Data**: Non-destructive seeding preserves manual data

## 📁 **Critical File Structure**

### **Backend Key Files**
```
/backend/
├── server-working.js              # Main server file (START HERE)
├── prisma/schema.prisma           # Database schema
├── seed-data-safe.js              # Safe database seeding (checks existing data)
├── routes/
│   ├── auth.js                    # Authentication endpoints
│   ├── deals.js                   # Deal management + categorization + commission
│   ├── teams.js                   # Team views and member management
│   ├── team-management.js         # Team CRUD operations
│   ├── targets.js                 # Quota/target management with backfill
│   ├── commissions.js             # Commission queries from deals table
│   ├── integrations.js            # CRM integrations (Google Sheets)
│   └── admin.js                   # Admin utilities
├── services/
│   ├── dealCommissionCalculator.js # Automatic commission calculation
│   └── googleSheets.js            # Google Sheets integration service
├── middleware/
│   ├── secureAuth.js              # JWT authentication middleware
│   ├── permissions.js             # Centralized permission management
│   └── roleHelpers.js             # Permission checking functions
└── .env                           # Environment variables
```

### **Frontend Key Files**
```
/frontend/
├── src/pages/
│   ├── login.tsx                  # Authentication page
│   ├── dashboard.tsx              # Main dashboard with live metrics
│   ├── deals/index.tsx            # 5-column drag-and-drop interface
│   ├── team.tsx                   # Team management (modular components)
│   ├── commissions.tsx            # Commission tracking and history
│   ├── settings.tsx               # Target/quota management wizard
│   └── integrations.tsx           # CRM integration management
├── src/components/
│   ├── layout.tsx                 # Sidebar navigation
│   ├── ProtectedRoute.tsx         # Route authentication
│   ├── CommissionChart.tsx        # Commission visualization
│   └── team/                      # Modular team components
│       ├── TeamMemberCard.tsx
│       ├── TeamStats.tsx
│       ├── QuotaWizard.tsx        # 4-step quota planning
│       └── TeamTargetInterceptModal.tsx
├── src/hooks/
│   └── useAuth.tsx                # Authentication state
├── src/lib/
│   └── api.ts                     # API client with JWT headers
└── src/types/                     # TypeScript definitions
```

## 🔧 **Environment Configuration**

### **Backend (.env)**
```bash
# Database - Local Development
DATABASE_URL="postgresql://username@localhost:5432/sales_commission_db"

# Authentication
JWT_SECRET=development-jwt-secret-key-123
PORT=3002
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:3000

# Google Sheets API (optional)
GOOGLE_SHEETS_CREDENTIALS='{...}' # Service account JSON
```

### **Frontend (.env.local)**
```bash
# API Connection
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### **Production Environment Variables**
- **Render Backend**: DATABASE_URL, JWT_SECRET, NODE_ENV=production, GOOGLE_SHEETS_CREDENTIALS
- **Vercel Frontend**: NEXT_PUBLIC_API_URL=https://sales-commission-backend-latest.onrender.com

## 🚀 **Development Workflow**

### **Local Development Setup**
```bash
# 1. Start PostgreSQL (if not running)
brew services start postgresql@14

# 2. Setup database (one-time)
createdb sales_commission_db

# 3. Backend setup
cd backend
npm install
npx prisma migrate deploy    # Create schema
node seed-data-safe.js       # Add test data (checks existing)
node server-working.js       # Start backend (port 3002)

# 4. Frontend setup (new terminal)
cd frontend
npm install
npm run dev                  # Start frontend (port 3000)

# 5. Access application
# Local: http://localhost:3000
# Login: test@company.com / password123
```

### **Branch Strategy**
- **main**: Production branch (auto-deploys to Vercel/Render)
- **develop**: Development branch for testing
- **feature/***: Feature branches for individual improvements

### **Deployment Commands**
```bash
# Deploy to production
git checkout main
git merge develop
git push origin main        # Triggers auto-deploy
```

## 🗄️ **Database Details**

### **Core Tables**
- **companies**: Multi-tenant company data
- **users**: Sales reps with roles (sales_rep, manager) + is_admin flag
- **deals**: CRM-synced deals with live commission calculations
- **deal_categorizations**: ML training data for rep decisions
- **targets**: Individual quota/commission settings (team_target field deprecated - see Team Target Architecture)
- **commissions**: Historical audit records for closed deals (separate from live calculations)
- **commission_approvals**: Approval workflow history and audit trail
- **crm_integrations**: Integration configurations (Google Sheets, HubSpot, Salesforce, etc.)
- **activity_log**: General system audit trail

### **🔄 Commission Architecture - Three-Layer System**

#### **Layer 1: Live Commission Calculations (deals table)**
- **Purpose**: Real-time commission projections and calculations
- **Location**: Directly on the `deals` table
- **Fields**:
  - `commission_amount`: Calculated commission value
  - `commission_rate`: Rate used for calculation
  - `commission_calculated_at`: Timestamp of calculation
- **When Updated**:
  - When deal amount changes
  - When deal stage/status changes
  - When commission rules change
  - Daily recalculation job (2 AM UTC)

#### **Layer 2: Commission Audit Records (commissions table)**
- **Purpose**: Immutable historical record for closed deals
- **Location**: Separate `commissions` table
- **Created When**: Deal moves to `closed_won` status
- **Contains**:
  - Snapshot of deal amount at time of closing
  - Applied commission rate and rules
  - Calculated commission amount
  - Target/quota information at time of calculation
  - Approval workflow status
- **Key Feature**: Once created, serves as permanent audit trail

#### **Layer 3: Approval Workflow (commission_approvals table)**
- **Purpose**: Track all approval actions and adjustments
- **Location**: `commission_approvals` table
- **Records**:
  - Review, approve, reject, adjust actions
  - Who performed each action and when
  - Notes and adjustment reasons
  - Previous and new status for each action
- **Relationship**: Links to records in `commissions` table

### **How They Work Together**
```
1. Deal Created → Live commission calculated on deals table
2. Deal Updated → Commission recalculated in real-time
3. Deal Closed → Commission record created in commissions table
4. Manager Reviews → Actions logged in commission_approvals table
5. Commission Approved → Status updated in commissions table
6. Commission Paid → Final status recorded with payment reference
```

### **Important Notes**
- **Deals table**: Always has the most current commission calculation
- **Commissions table**: Has the official, auditable commission record for closed deals
- **Commission_approvals**: Has the complete history of all actions taken
- **Why separate?**: Compliance, audit trail, and ability to adjust commissions post-closing

### **Team Target Architecture**
- All targets are individual targets (no separate team aggregation records)
- Team targets are calculated dynamically by summing individual team member targets
- `team_target` field is deprecated but retained for backwards compatibility
- API endpoint `/targets/team-aggregate` provides dynamic team aggregation
- See TEAM_TARGET_MIGRATION.md for migration details

### **Database Operations**
```bash
# Check database status
psql -d sales_commission_db -c "SELECT email FROM users;"

# Reset database (WARNING: deletes all data)
dropdb sales_commission_db
createdb sales_commission_db
cd backend && npx prisma migrate deploy && node seed-data-safe.js

# View schema
cd backend && npx prisma studio  # Visual database browser
```

### **Schema Change Protocol (IMPORTANT)**
When making changes to the Prisma schema, ALWAYS create a migration:
```bash
# 1. Make changes to schema.prisma
# 2. Create migration (NEVER skip this step)
cd backend
npx prisma migrate dev --name descriptive_name_here

# 3. Commit BOTH the schema.prisma AND the new migration file
git add prisma/schema.prisma prisma/migrations/
git commit -m "Add migration: descriptive_name_here"

# NEVER use these commands for schema changes:
# ❌ npx prisma db push (only for initial setup)
# ❌ Manual SQL changes without migration files
# ❌ Editing schema.prisma without creating migrations
```

**Why this matters**: Schema changes must be tracked in migration files to ensure consistency across all development environments and production deployments.

## 🧪 **Test Data & Accounts**

### **Test Account**
- **Email**: test@company.com
- **Password**: password123
- **Role**: manager with admin permissions
- **Company**: Test Company

### **Available Test Data**
- **Users**: 6 realistic team members with different roles
- **Deals**: 17 B2B deals with various amounts and stages
- **Targets**: £250,000 annual quota for 2025
- **Categories**: Deals categorized across commit/best case buckets

## 🎯 **Current Development Priorities**

### **🚧 IN PROGRESS: HubSpot Integration (feature/hubspot-integration branch)**

#### **Objective**
Build a robust HubSpot CRM integration to automatically sync deals and enable real-time commission tracking.

#### **Key Features to Implement**
1. **OAuth 2.0 Authentication**: Secure connection to HubSpot accounts
2. **Deal Synchronization**: 
   - Initial bulk import of existing deals
   - Real-time webhook updates for deal changes
   - Bi-directional sync capabilities
3. **Field Mapping**:
   - Map HubSpot deal properties to our deal fields
   - Support custom HubSpot properties
   - Handle HubSpot pipelines and deal stages
4. **Commission Integration**:
   - Automatically calculate commissions when deals close
   - Push commission data back to HubSpot as custom properties
   - Support HubSpot's multiple pipelines
5. **User Mapping**:
   - Link HubSpot deal owners to system users
   - Support team hierarchies from HubSpot

#### **Technical Implementation**
- **API**: HubSpot API v3 (REST)
- **Authentication**: OAuth 2.0 with refresh tokens
- **Webhooks**: HubSpot webhook subscriptions for real-time updates
- **Rate Limiting**: Respect HubSpot's API limits (100 requests/10 seconds)
- **Error Handling**: Retry logic with exponential backoff

### **2. Other Planned CRM Integrations**
- **Salesforce OAuth**: Real-time deal sync
- **Pipedrive Support**: API integration
- **Deal ID Management**: Automatic unique ID generation for CRMs without Deal IDs

### **2. Advanced Analytics**
- **AI-Powered Predictions**: Deal probability scoring using collected ML data
- **Performance Analytics**: Team performance insights
- **Forecast Accuracy**: Track prediction vs actual outcomes

### **3. Commission System Features**
- **Approval Workflows**: Multi-user commission approval
- **Complex Commission Rules**: Tiered rates, bonuses, overrides
- **Payment Integration**: Track actual commission payments

## 🔒 **Security & Permissions**

### **IMPORTANT: Role Field Deprecation**
⚠️ **The `role` field on the users table is DEPRECATED as of 2025-08-08**
- **DO NOT USE**: `role` field for permission checks
- **USE INSTEAD**: `is_manager` and `is_admin` boolean flags
- **Reason**: Boolean flags provide clearer, more flexible permission management
- **Migration**: All existing code should check `is_manager` or `is_admin` flags instead of `role` field

### **Current Permission System**
- **is_admin**: Boolean flag - grants full system access, can manage teams, users, and all settings
- **is_manager**: Boolean flag - grants team management capabilities, can view team data
- **Basic users**: Neither flag set - can only manage own deals and see own targets

### **Permission Helpers** (middleware/permissions.js & roleHelpers.js)
```javascript
// Centralized permission checks - ALWAYS use these helpers
attachPermissions()      // Middleware to add user permissions to request
requireAdmin()          // Middleware to require is_admin: true
requireManager()        // Middleware to require is_manager: true
canManageTeam(user)     // Check if user can manage team (is_admin || is_manager)
isAdmin(user)          // Check if user has admin permissions (is_admin: true)

// ❌ WRONG - Do not use role field
if (user.role === 'manager') { ... }

// ✅ CORRECT - Use boolean flags
if (user.is_manager || user.is_admin) { ... }
```

## 🛠️ **Known Technical Considerations**

### **Working Configurations**
- ✅ Tailwind CSS v3.4.0 (properly configured)
- ✅ Next.js Pages Router (App Router causes conflicts)
- ✅ Express 4.18.2 (v5.x has route parsing issues)
- ✅ PostgreSQL local + cloud (both working)
- ✅ JWT localStorage auth (working in development)
- ✅ Deal-based commission architecture (no separate commission records)

### **Development Notes**
- **Seed Script**: Use `seed-data-safe.js` which preserves existing data
- **Database**: Restart-persistent (survives computer restarts)
- **Hot Reloading**: Both frontend and backend support live changes
- **Error Handling**: Comprehensive error boundaries and API validation
- **Modern UI**: Glassmorphism, gradients, smooth animations
- **Commission Calculation**: Automatic on deal closure and target creation

### **Date/Time Standardization (CRITICAL)**
All date/time handling in this application follows UTC standards to ensure consistency:

#### **Creating Dates**
```javascript
// ✅ CORRECT - Always use UTC
const periodStart = new Date(Date.UTC(year, month, day));
const periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

// ❌ WRONG - Never use local time
const periodStart = new Date(year, month, day);
```

#### **Date Comparisons**
```javascript
// ✅ CORRECT - Use date range overlaps for period matching
const periodsMatch = commissionStart <= currentEnd && commissionEnd >= currentStart;

// ❌ WRONG - Don't use exact string matching for dates
const periodsMatch = commissionStart.toISOString() === currentPeriod.start;
```

#### **Date Methods**
- Always use UTC methods: `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`
- Never use local methods: `getFullYear()`, `getMonth()`, `getDate()`

#### **Date Storage**
- Database stores all dates in UTC
- API returns dates in ISO 8601 format
- Frontend displays dates using `toLocaleDateString('en-GB')` for user's local timezone

This standardization prevents timezone-related bugs and ensures consistent behavior across different user locations.

### **API Endpoints Structure**
```bash
# Authentication
POST /auth/login
POST /auth/register
GET /auth/me

# Dashboard
GET /dashboard/sales-rep    # Supports view parameter for managers

# Deal Management  
GET /deals
POST /deals
PUT /deals/:id
PATCH /deals/:id/categorize  # Drag-and-drop categorization

# Team Management
GET /team                    # Team view with performance metrics
GET /teams                   # Team member list
POST /teams/invite          # Invite new member
PATCH /teams/:id            # Update member
DELETE /teams/:id           # Remove member

# Target/Quota Management
GET /targets
POST /targets               # Creates parent and child targets
PUT /targets/:id
PATCH /targets/:id/deactivate
POST /targets/resolve-conflicts

# Commission Tracking
GET /commissions            # Query deals table for commission data
GET /commissions/team-members
GET /commissions/team       # Team commission summary

# CRM Integrations
GET /integrations
POST /integrations
POST /integrations/:id/sync
DELETE /integrations/:id
GET /integrations/template/sheets
```

## 🐳 **Docker Alternative (Optional)**
```bash
# Quick Docker setup (alternative to manual setup)
./docker-setup.sh          # Automated containerization
docker-compose up -d        # Start all services
# Access: http://localhost:3000
```

## 📊 **Success Metrics**
- **Authentication**: Users can login and access dashboard
- **Deal Flow**: Deals can be dragged between categorization columns
- **Team Management**: Admins can invite/edit team members
- **Target Setting**: Quota wizard creates targets successfully
- **Commission Tracking**: Automatic calculation on deal closure
- **Data Persistence**: All changes save to database correctly
- **Responsive UI**: Works on desktop and mobile

---

**Last Updated**: 2025-08-26  
**Production Status**: ✅ Fully deployed and operational  
**Development Status**: ✅ Local environment fully functional  
**Current Work**: 🚧 HubSpot Integration (feature/hubspot-integration branch)  
**Next Session Priority**: Complete HubSpot OAuth flow and deal sync

## 🚨 DATABASE PROTECTION RULES (CRITICAL)

**NEVER EVER perform these operations without explicit user permission:**
1. `prisma migrate reset` - This DELETES ALL DATA
2. `DROP TABLE` or `TRUNCATE` commands
3. `deleteMany()` without specific conditions
4. Any operation that removes production data
5. Running `seed-data.js` directly (use `seed-data-safe.js`)

**ALWAYS use these safe alternatives:**
- Use `npm run migrate:safe` instead of direct migrate commands
- Use `npm run seed:safe` instead of `seed-data.js`
- Use `npm run backup` before any migrations
- Check for existing data before seeding

**Database Protection System:**
- All destructive operations require environment variables:
  - `ALLOW_DESTRUCTIVE_DATABASE_OPERATIONS=true` for general permission
  - `ALLOW_DATABASE_RESET=true` for migration resets
- Interactive confirmations for dangerous operations
- Automatic database statistics display before operations
- Backup reminders and scripts

**Safe Commands:**
```bash
# Safe migration
npm run migrate

# Safe seeding (checks for existing data)
npm run seed:safe

# Create backup
npm run backup

# Backup then migrate
npm run backup:before:migrate
```

**NEVER use these commands without explicit permission:**
```bash
# DANGEROUS - Requires explicit permission
npx prisma migrate reset
npm run migrate:reset:force
npm run seed:unsafe
```

**Protection Files:**
- `/backend/database-protection.js` - Core protection utilities
- `/backend/seed-data-safe.js` - Safe seeding with checks
- `/backend/migrate-safe.js` - Protected migration wrapper
- `/backend/backup-database.js` - Automated backup creation
- dont ever commit to main without confirming with me first