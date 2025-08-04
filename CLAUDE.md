# Sales Commission SaaS - Claude Code Development Context

## ⚠️ **CRITICAL INSTRUCTIONS FOR CLAUDE**
1. **NEVER run `prisma migrate reset` or any command that deletes data without explicit permission**
2. **ALWAYS check for existing data before seeding**
3. **NEVER use `seed-data.js` directly - use `seed-data-safe.js`**
4. **ALWAYS create backups before migrations**
5. **NEVER delete user data without explicit confirmation**

## 🏢 **Project Overview**
**Name**: Sales Commission SaaS  
**Purpose**: Sales pipeline and commission tracking solution for small to medium b2b companies
**Core Value**: Simple pipeline clarity for sales reps, outcome forecasting for management  
**Key Principle**: NOT a CRM - focuses purely on commission tracking and pipeline commitment. Integration for CRM data is fundamental.

**Target Users**: UK SMBs with 5-50 sales reps using Salesforce, HubSpot, or Pipedrive

## 🎯 **Current Working State (Production Ready)**

### **✅ What's Working Right Now**
- **Authentication**: JWT-based login with localStorage (test@company.com / password123)
- **Dashboard**: Live data from PostgreSQL with modern gradient UI
- **Deal Management**: 5-column drag-and-drop categorization (Pipeline → Commit → Best Case → Closed Won (managed by CRM))
- **Team Management**: Role-based access with admin permissions
- **Target Management**: Quota planning wizard with UK fiscal year support
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
├── seed-data.js                   # Database seeding (safe to re-run)
├── routes/
│   ├── auth.js                   # Authentication endpoints
│   ├── dashboard.js              # Dashboard data
│   ├── deals.js                  # Deal management + categorization
│   ├── teams.js                  # Team management + permissions
│   ├── targets.js                # Quota/target management
│   └── analytics.js              # ML training data collection
├── middleware/
│   ├── secureAuth.js             # JWT authentication middleware
│   └── roleHelpers.js            # Permission checking functions
└── .env                          # Environment variables (see below)
```

### **Frontend Key Files**
```
/frontend/
├── src/pages/
│   ├── login.tsx                 # Authentication page
│   ├── dashboard.tsx             # Main dashboard with live metrics
│   ├── deals/index.tsx           # 5-column drag-and-drop interface
│   ├── team.tsx                  # Team management (modular components)
│   └── settings.tsx              # Target/quota management wizard
├── src/components/
│   ├── layout.tsx                # Sidebar navigation
│   ├── ProtectedRoute.tsx        # Route authentication
│   └── team/                     # Modular team components
│       ├── TeamMemberCard.tsx
│       ├── TeamStats.tsx
│       ├── QuotaWizard.tsx       # 4-step quota planning
│       └── [4 other components]
├── src/hooks/
│   └── useAuth.tsx               # Authentication state
├── src/lib/
│   └── api.ts                    # API client with JWT headers
└── src/types/                    # TypeScript definitions
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
```

### **Frontend (.env.local)**
```bash
# API Connection
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### **Production Environment Variables**
- **Render Backend**: DATABASE_URL, JWT_SECRET, NODE_ENV=production
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
node seed-data.js           # Add test data (safe to re-run)
node server-working.js      # Start backend (port 3002)

# 4. Frontend setup (new terminal)
cd frontend
npm install
npm run dev                 # Start frontend (port 3000)

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
- **deals**: CRM-synced deal data with categorization tracking
- **deal_categorizations**: ML training data for rep decisions
- **targets**: Quota/commission settings with UK fiscal year support
- **commissions**: Calculated commission payments

### **Database Operations**
```bash
# Check database status
psql -d sales_commission_db -c "SELECT email FROM users;"

# Reset database (WARNING: deletes all data)
dropdb sales_commission_db
createdb sales_commission_db
cd backend && npx prisma migrate deploy && node seed-data.js

# View schema
cd backend && npx prisma studio  # Visual database browser
```

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

### **1. System consistency
- ** ensure that all endpoints work effectively
- ** ensure that the system is flexible, limiting hardcoded gates to visibility and functionality
- ** Configure system to work better at scale

### **2. Commission System Enhancement**
- **Approval Workflows**: Multi-user commission approval
- **Complex Commission Rules**: Tiered rates, bonuses, overrides
- **Commission History**: historic commissions stored for analysis

### **3. Advanced Analytics**
- **AI-Powered Predictions**: Deal probability scoring using collected ML data
- **Performance Analytics**: Team performance insights
- **Forecast Accuracy**: Track prediction vs actual outcomes

## 🔒 **Security & Permissions**

### **Role System**
- **sales_rep**: Basic user, can manage own deals and see own targets
- **manager**: Can see team data, manage team members (if is_admin: true)
- **Admin Permission**: is_admin boolean field for managers only

### **Permission Helpers** (middleware/roleHelpers.js)
```javascript
isAdmin(user)           // Check if user has admin permissions
canManageTeam(user)     // Check if user can manage team
requireAdmin()          // Middleware to require admin access
```

## 🛠️ **Known Technical Considerations**

### **Working Configurations**
- ✅ Tailwind CSS v3.4.0 (properly configured)
- ✅ Next.js Pages Router (App Router causes conflicts)
- ✅ Express 4.18.2 (v5.x has route parsing issues)
- ✅ PostgreSQL local + cloud (both working)
- ✅ JWT localStorage auth (working in development)

### **Development Notes**
- **Seed Script**: Safe to re-run, preserves existing data
- **Database**: Restart-persistent (survives computer restarts)
- **Hot Reloading**: Both frontend and backend support live changes
- **Error Handling**: Comprehensive error boundaries and API validation
- **Modern UI**: Glassmorphism, gradients, smooth animations

### **API Endpoints Structure**
```bash
# Authentication
POST /auth/login
POST /auth/register

# Dashboard
GET /dashboard/metrics

# Deal Management  
GET /deals
PUT /deals/:id/categorize  # Drag-and-drop categorization
POST /deals

# Team Management
GET /teams
POST /teams/invite
PUT /teams/:id
DELETE /teams/:id

# Target/Quota Management
GET /targets
POST /targets
PUT /targets/:id
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
- **Data Persistence**: All changes save to database correctly
- **Responsive UI**: Works on desktop and mobile

---

**Last Updated**: 2025-08-04  
**Production Status**: ✅ Fully deployed and operational  
**Development Status**: ✅ Local environment fully functional  
**Next Session Priority**: CRM integrations (Salesforce, HubSpot, Pipedrive)

## 🚨 DATABASE PROTECTION RULES (CRITICAL)

**NEVER EVER perform these operations without explicit user permission:**
1. `prisma migrate reset` - This DELETES ALL DATA
2. `DROP TABLE` or `TRUNCATE` commands
3. `deleteMany()` without specific conditions
4. Any operation that removes production data
5. Running `seed-data.js` directly

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