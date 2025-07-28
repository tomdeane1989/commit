# CLAUDE Context - Sales Commission SaaS

## 🏢 **Project Overview**
**Name**: Sales Commission SaaS  
**Purpose**: Lightweight commission tracking solution for UK-based small to medium B2B companies  
**Core Value**: Simple pipeline clarity for sales reps, outcome forecasting for management  
**Key Principle**: NOT a CRM - focuses purely on commission tracking and deal categorization

## 🎯 **Target Users**
- **Sales Reps**: Need clear pipeline visibility and commission tracking
- **Sales Management**: Need weekly/monthly/quarterly sales outcome forecasting
- **Company Size**: UK-based SMBs with 5-50 sales reps
- **Industry**: B2B companies using Salesforce, HubSpot, or Pipedrive

## 🏗️ **Architecture & Stack**

### **Backend** (Node.js)
- **Framework**: Express 4.18.2 (NOT 5.x - causes route parsing issues)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens with localStorage
- **API**: RESTful endpoints with comprehensive validation
- **Location**: `/backend/` directory

### **Frontend** (Next.js)
- **Framework**: Next.js 15.4.1 with Pages Router (NOT App Router)
- **Styling**: Tailwind CSS v3.4.0 (FIXED: was v4, downgraded for compatibility)
- **State Management**: TanStack React Query + React Context
- **Icons**: Lucide React
- **Location**: `/frontend/` directory

### **Database Schema** (AI-Optimized)
- **companies**: Multi-tenant company data with AI metadata
- **users**: Sales reps with performance profiles
- **deals**: CRM-synced deal data with AI predictions
- **deal_categorizations**: Separate tracking for rep decisions (ML training)
- **targets**: Sales quotas with forecasting
- **commissions**: Calculated payments with breakdowns
- **forecasts**: Historical prediction snapshots
- **activity_log**: Comprehensive audit trail for AI

## 🚀 **Current Status**

### **✅ Completed Phase 1 Features**
- ✅ Database schema and migrations
- ✅ **Authentication system with localStorage JWT for development**
- ✅ **Modern dashboard with live database integration**
- ✅ **Backend API with comprehensive security and optimization**
- ✅ **Drag-and-drop deal categorization interface**
- ✅ **Target setting and management system**
- ✅ **Team management with modular component architecture**
- ✅ **Fundraising-style quota progress meter**
- ✅ **ML training data collection for categorization**
- ✅ Modern business application UI with gradients and animations
- ✅ **Responsive design with smooth client-side navigation**
- ✅ **Security hardening and error handling**
- ✅ **Quota Planning Wizard with 4-step interface**
- ✅ **Pro-rating logic for mid-year hires**
- ✅ **UK fiscal year support (April 6 - April 5)**

### **🔄 Working Features**
- **User authentication with localStorage JWT tokens for development**
- **Dashboard with live data from real database seed**
- **5-column deal categorization layout:**
  - Pipeline (CRM synced deals - default state)
  - Commit bucket (drag-and-drop target for high confidence deals)
  - Best Case bucket (drag-and-drop target for speculative deals)
  - Closed Won (reference/display only)
  - Progress meter (stacked quota visualization)
- **Drag-and-drop deal categorization** - smooth single-motion workflow
- **Commission calculations with visual progress tracking and correct amounts**
- **Advanced Target Management:**
  - 4-step quota planning wizard with conflict detection
  - Role-based and individual target creation
  - Automatic conflict resolution modal
  - Pro-rating for mid-year hires
  - UK fiscal year support (April 6 - April 5)
  - Grouped table display with expandable team member rows
  - Active/inactive target filtering
- **Team management system with role-based access control**
- **Advanced Team Performance View:**
  - **Period filtering with toggle buttons (Monthly/Quarterly/Yearly)**
  - **Three-tier progress visualization consistent with deals page logic**
  - **Deal date filtering for accurate period-based reporting**
  - **Pro-rated quota calculations (£480K annual → £120K quarterly → £40K monthly)**
  - **Closed won deals shown as cumulative year-to-date achievements**
  - **Pipeline deals filtered by expected close date within selected period**
  - **Commit/Best Case deals from deal categorizations count toward quota progress**
- **Modular component architecture (5 team components)**
- **Protected routes with proper authentication flow**
- **Session tracking for ML data collection**
- **Comprehensive seed data** with realistic UK B2B deal scenarios
- **Smooth client-side navigation without page refreshes**
- **Google Sheets integration with real-time data sync and template downloads**

### **🎨 Modern UI Features**
- Glassmorphism effects with backdrop blur
- Gradient backgrounds and sophisticated color schemes
- Professional sidebar with active state indicators
- Animated progress meters and smooth transitions
- Responsive card layouts with hover effects
- Modern form inputs and interactive elements
- **Error boundaries and comprehensive error handling**
- **Loading states and user feedback throughout the app**

### **🔧 Recent Technical Improvements (Latest Session)**

#### **✅ Complete Role & Permission System Overhaul**
- **Admin Permission Model**: Admin is now a permission for managers, not a separate role
- **Database Schema**: Added `is_admin` boolean field to users table with migration
- **Role Consistency**: Only `sales_rep` and `manager` roles exist; admins are `manager` + `is_admin: true`
- **Permission Helpers**: Created `roleHelpers.js` middleware with functions like `isAdmin()`, `canManageTeam()`
- **Comprehensive Updates**: Updated all role checks across backend APIs (teams, targets, deals, etc.)
- **Authentication Fix**: Added `is_admin` field to authentication middleware user query

#### **✅ Enhanced Team Management System**
- **User Editing**: Full CRUD operations for team member management (name, role, admin status, territory, manager)
- **Inactive Users Toggle**: Checkbox to show/hide inactive team members (default: hidden)
- **Admin-Only Operations**: Only users with admin permission can invite, edit, or delete team members
- **Backend Filtering**: `show_inactive` parameter for team API with proper company-based filtering
- **Real-time Updates**: Team data refreshes based on inactive filter selection

#### **✅ Target Creation Validation System**
- **Step-by-Step Validation**: Comprehensive validation for each step of quota wizard
- **Required Field Gates**: Visual indicators (*) and validation prevent empty mandatory fields
- **Input Constraints**: HTML validation (min/max values, required attributes) on form inputs
- **Real-time Feedback**: Error display with specific messages and blocked navigation until valid
- **Commission Rate Validation**: Must be between 0.1% and 100% with proper number formatting

#### **✅ Commission Calculation System**
- **Real-time Calculation**: On-the-fly commission calculation based on closed deals and active targets
- **Proper Data Queries**: Fixed closed deals query to use `close_date` when `closed_date` is null
- **Period-Aware**: Commissions calculated only for deals within selected time period
- **Formula**: `closedWonAmount × commission_rate` with fallback to stored commission records
- **Database Query Fix**: Added missing `commission_rate` field to targets query in team API

#### **✅ Security & Data Integrity**
- **Cross-Company Data Leak Fix**: Fixed targets API to filter by company_id, preventing data bleeding
- **Authentication Security**: Enhanced JWT middleware with proper role and admin permission checks
- **Company-Based Filtering**: All queries now properly filter by company to ensure multi-tenant security
- **Input Validation**: Server-side validation for all target creation and user management operations

#### **✅ User Experience Improvements**
- **Professional Success Messages**: Replaced browser alerts with styled in-app notifications
- **Copy-to-Clipboard**: Email and password copy buttons for team invitations
- **Validation Error Display**: Clear error panels with specific validation messages
- **Required Field Indicators**: Red asterisks (*) on mandatory form fields
- **Smooth Navigation**: Step-by-step validation prevents advancing with incomplete data

### **⚠️ Next Phase Priorities**
- CRM sync implementations (Salesforce, HubSpot, Pipedrive)
- Commission approval workflows and multi-user collaboration
- Advanced reporting and analytics dashboards
- AI-powered deal probability predictions
- Multi-tenant company management

## 🗄️ **Database Configuration**

### **📊 Database Overview**
- **Database Engine**: PostgreSQL for both local and production environments
- **ORM**: Prisma Client with comprehensive schema migrations
- **Data Persistence**: All environments use persistent PostgreSQL databases
- **Seed Data**: Non-destructive seeding preserves manually created data

### **🏠 Local Development Database**
- **Location**: Local PostgreSQL server via Homebrew
- **Database Name**: `sales_commission_db`
- **Connection**: `postgresql://username@localhost:5432/sales_commission_db`
- **Service Management**: `brew services start postgresql@14`
- **Data Persistence**: ✅ Survives computer restarts and application restarts
- **Seed Behavior**: Only seeds when database is completely empty

#### **Local Database Setup Commands**
```bash
# 1. Start PostgreSQL service (if not running)
brew services start postgresql@14

# 2. Create database (one-time setup)
createdb sales_commission_db

# 3. Run migrations to create schema
cd backend && npx prisma migrate deploy

# 4. Seed data (only if database is empty)
cd backend && node seed-data.js

# 5. Verify database connection
psql -d sales_commission_db -c "SELECT COUNT(*) FROM users;"
```

### **🌐 Production Database**
- **Platform**: Render PostgreSQL
- **Database Name**: `sales_commission_saas_db` (production)
- **Connection**: Managed via Render dashboard environment variables
- **Backups**: Automatic daily backups via Render
- **Data Persistence**: ✅ Fully persistent cloud database
- **Access**: Read-only access via Render dashboard

#### **Production Database Access**
```bash
# Access via Render dashboard -> Database -> Connect
# Connection string provided in Render environment
```

### **🔄 Database Data Management**

#### **Seed Data Behavior (IMPORTANT)**
The seed script (`seed-data.js`) has been updated to preserve manual data:

- ✅ **Non-Destructive**: Only runs when database is completely empty
- ✅ **Data Preservation**: Preserves all manually created users, deals, and targets
- ✅ **Safe Re-runs**: Can run multiple times without data loss
- ❌ **Old Behavior**: Previously cleared data in development mode (FIXED)

#### **Standard Test Data**
When database is empty, creates:
- **Test Company**: "Test Company" with domain "testcompany.com"
- **Test User**: test@company.com / password123 (admin role)
- **Test Deals**: 17 realistic B2B deals with proper categorization
- **Test Target**: £250,000 annual quota for 2025

#### **Manual Data Examples**
Your manually created data persists:
- **Custom Users**: tom@test.com and team members
- **Custom Companies**: Additional organizations
- **Custom Deals**: User-created opportunities
- **Custom Targets**: Manually configured quotas

## 🐳 **Containerization & Docker**

### **📦 Docker Architecture**
The application is fully containerized with multi-stage builds for optimal production deployment:

- **Frontend Container**: Next.js with standalone output (Alpine Linux)
- **Backend Container**: Node.js/Express with Prisma (Alpine Linux)  
- **Database Container**: PostgreSQL 16 with persistent volumes
- **Nginx Proxy**: Production reverse proxy with rate limiting (optional)

### **🚀 Quick Docker Setup**
```bash
# 1. Clone and setup
git clone <repo> && cd sales-commission-saas

# 2. Run automated setup
./docker-setup.sh

# 3. Access application
# Frontend: http://localhost:3000
# Backend: http://localhost:3002
# Database: localhost:5432
```

### **🛠️ Docker Commands**
```bash
# Development environment
docker-compose up -d                    # Start all services
docker-compose down                     # Stop all services
docker-compose logs -f                  # View logs
docker-compose build --no-cache         # Rebuild images

# Production environment  
docker-compose -f docker-compose.prod.yml up -d    # Production deploy
docker-compose -f docker-compose.prod.yml down     # Stop production

# Individual services
docker-compose up -d database           # Start only database
docker-compose exec backend npm run migrate        # Run migrations
docker-compose exec backend node seed-data.js      # Seed database
```

### **📁 Docker Files Structure**
```
/
├── docker-compose.yml              # Development environment
├── docker-compose.prod.yml         # Production environment
├── docker-setup.sh                 # Automated setup script
├── nginx.conf                      # Nginx reverse proxy config
├── .env.docker                     # Environment template
├── backend/
│   ├── Dockerfile                  # Multi-stage Node.js build
│   └── .dockerignore              # Optimize build context
└── frontend/
    ├── Dockerfile                  # Multi-stage Next.js build  
    └── .dockerignore              # Optimize build context
```

### **🔧 Docker Benefits**

#### **Development Advantages**
- **Instant Setup**: New team members up and running in minutes
- **Environment Consistency**: Eliminates "works on my machine" issues
- **Isolated Services**: Database, backend, frontend run independently
- **Hot Reloading**: Development containers support live code changes

#### **Production Advantages**  
- **Cloud Platform Flexibility**: Deploy to any Docker-compatible platform
- **Scalability**: Easy horizontal scaling with container orchestration
- **Security**: Multi-stage builds minimize attack surface
- **Resource Efficiency**: Optimized Alpine Linux base images

#### **Deployment Platforms**
- ✅ **Render**: Direct Docker deploy from repository
- ✅ **Railway**: Container-based deployment  
- ✅ **DigitalOcean App Platform**: Docker container support
- ✅ **AWS ECS/Fargate**: Container orchestration
- ✅ **Google Cloud Run**: Serverless containers
- ✅ **Azure Container Instances**: Managed containers

### **🔒 Production Security**
- **Non-root users**: All containers run as unprivileged users
- **Multi-stage builds**: Only production dependencies in final images
- **Health checks**: Built-in container health monitoring
- **Rate limiting**: Nginx proxy with API rate limits
- **Security headers**: CORS, CSP, and security headers configured

### **📊 Container Monitoring**
```bash
# Container health status
docker-compose ps

# Resource usage
docker stats

# Container logs
docker-compose logs backend -f
docker-compose logs frontend -f
docker-compose logs database -f
```

## 🏃‍♂️ **Development Environment**

### **🌐 Current Cloud Deployment**
- **Frontend**: Vercel (https://sales-commission-saas.vercel.app/)
- **Backend**: Render (auto-deploy from main branch)
- **Database**: PostgreSQL on Render
- **Status**: ✅ Fully operational with all issues resolved

### **🚢 Docker vs Current Deployment**

#### **Current Setup (Vercel + Render)**
- ✅ **Working**: Production deployment is stable
- ✅ **Automatic**: Git-based deployment from main branch
- ❌ **Platform Lock-in**: Tied to specific cloud providers
- ❌ **Environment Differences**: Local vs production setup varies
- ❌ **Onboarding Complexity**: New developers need manual setup

#### **Docker Benefits**
- ✅ **Platform Independence**: Deploy anywhere that supports containers
- ✅ **Environment Parity**: Identical local and production environments
- ✅ **Team Onboarding**: Single `./docker-setup.sh` command
- ✅ **Cost Flexibility**: Compare pricing across platforms easily
- ✅ **Migration Ready**: Move between cloud providers without re-architecture

#### **Migration Strategy** 
```bash
# Phase 1: Docker for local development (ready now)
./docker-setup.sh

# Phase 2: Optional production migration
# - Deploy to Render using Docker
# - Keep Vercel + Render as backup
# - Migrate DNS when confident

# Phase 3: Platform optimization
# - Compare costs: Render vs Railway vs DigitalOcean
# - Implement container scaling if needed
```

### **💻 Local Development**
```bash
# Backend (Port 3002)
cd backend
node server-working.js

# Frontend (Port 3000) 
cd frontend
npm run dev

# Database operations
cd backend
npm run migrate     # Run migrations
npm run generate    # Generate Prisma client  
npm run seed        # Populate test data
```

### **🔄 Branch-Based Development Workflow**
```bash
# Development workflow (use dev-tools.sh)
./dev-tools.sh new-feature "feature-name"  # Create feature branch
./dev-tools.sh deploy-prod                 # Deploy to production

# Manual workflow
git checkout develop                       # Switch to develop
git pull origin develop                    # Get latest changes
git checkout -b "feature/feature-name"     # Create feature branch
# ... make changes ...
git checkout develop                       # Back to develop
git merge feature/feature-name             # Merge feature
git checkout main                          # Switch to main
git merge develop                          # Merge to main
git push origin main                       # Deploy to production
```

### **🗂️ Branch Strategy**
- **main**: Production branch (auto-deploys to Vercel/Render)
- **develop**: Development branch for local testing
- **feature/***: Feature branches for individual improvements

## 🧪 **Test Account**
- **Email**: test@company.com
- **Password**: password123
- **Role**: admin
- **Company**: Test Company

## 🗺️ **Roadmap & Next Steps**

### **✅ Phase 1: Core Functionality** (COMPLETED)
- ✅ Authentication and user management
- ✅ Modern dashboard with sophisticated metrics
- ✅ Deal pipeline visualization with drag-and-drop
- ✅ Deal categorization interface (5-column layout)
- ✅ Target setting and progress tracking interface
- ✅ ML training data collection infrastructure

### **🔄 Phase 2: Deal Management** (Current Focus)
- ✅ Deal categorization (drag-and-drop) - COMPLETE
- Bulk deal operations
- Deal notes and history tracking
- Commission rule configuration
- Advanced filtering and search

### **Phase 3: CRM Integration**
- Salesforce OAuth and real-time sync
- HubSpot integration with webhooks
- Pipedrive webhook support
- Google Sheets import/export
- Automated deal synchronization

### **Phase 4: Management Features**
- Team performance dashboards
- Advanced reporting and analytics
- Forecast accuracy tracking
- Commission approval workflows
- Multi-user collaboration tools

### **Phase 5: AI Features**
- Deal probability predictions using ML data
- Commission optimization recommendations
- Performance pattern analysis
- Automated insights and alerts
- Predictive forecasting

## 🛠️ **Technical Considerations**

### **✅ FIXED Issues**
- ✅ Tailwind CSS configuration (v3.4.0 with proper config file)
- ✅ PostCSS plugin compatibility resolved
- ✅ Hydration errors fixed with client-side rendering patterns
- ✅ Modern UI styling now working correctly

### **Known Issues**
- Express 5.x causes route parsing errors (use 4.18.2)
- Next.js App Router conflicts with Pages Router

### **File Structure**
```
/backend/
  ├── prisma/schema.prisma          # Database schema
  ├── routes/                       # API endpoints
  │   ├── auth.js                  # Authentication endpoints
  │   ├── dashboard.js             # Dashboard data endpoints
  │   ├── deals.js                 # Deal management endpoints
  │   ├── teams.js                 # Team management endpoints
  │   ├── targets.js               # Target/quota endpoints
  │   └── analytics.js             # ML training data collection
  ├── middleware/                   # Security and error handling
  │   ├── secureAuth.js            # JWT authentication middleware
  │   ├── csrfProtection.js        # CSRF protection (unused in dev)
  │   └── errorHandler.js          # Standardized error responses
  ├── server-working.js            # Main server file
  └── .env                         # Environment variables

/frontend/
  ├── src/pages/                   # Pages Router pages
  │   ├── index.tsx                # Root redirect page
  │   ├── login.tsx                # Authentication page
  │   ├── dashboard.tsx            # Modern dashboard with live data
  │   ├── deals/index.tsx          # 5-column categorization interface
  │   ├── team.tsx                 # Team management (modular)
  │   └── settings.tsx             # Target management system
  ├── src/components/              # Reusable components
  │   ├── layout.tsx               # Modern sidebar with client-side nav
  │   ├── ProtectedRoute.tsx       # Route authentication wrapper
  │   ├── ErrorBoundary.tsx        # React error boundary
  │   ├── QueryErrorBoundary.tsx   # API error boundary
  │   └── team/                    # Modular team components
  │       ├── TeamMemberCard.tsx   # Individual member display
  │       ├── TeamStats.tsx        # Performance metrics
  │       ├── TeamFilters.tsx      # Search and filtering
  │       ├── InviteModal.tsx      # Member invitation
  │       └── QuotaWizard.tsx      # 4-step quota planning wizard
  ├── src/hooks/                   # Custom React hooks
  │   └── useAuth.tsx              # Authentication state management
  ├── src/lib/                     # API client and utilities
  │   └── api.ts                   # Axios client with JWT headers
  ├── src/types/                   # TypeScript definitions
  └── src/styles/                  # Global CSS and Tailwind
      └── globals.css              # Tailwind CSS configuration
```

### **🔧 Environment Variables**

#### **Local Development (.env files)**
```bash
# Backend (.env) - CURRENT CONFIGURATION
DATABASE_URL="postgresql://thomasdeane@localhost:5432/sales_commission_db"  # Local PostgreSQL
JWT_SECRET=development-jwt-secret-key-123      # Development JWT secret
PORT=3002                                      # Backend port
NODE_ENV=development                           # Environment mode
FRONTEND_URL=http://localhost:3001             # Frontend URL for CORS

# Frontend (.env.development) 
NEXT_PUBLIC_API_URL=http://localhost:3002      # Local backend URL

# Frontend (.env.local) - Optional overrides
NEXT_PUBLIC_API_URL=http://localhost:3002
```

#### **Production Environment Variables (Cloud)**
```bash
# Backend (Render) - Set in Render Dashboard
DATABASE_URL=postgresql://user:pass@host:port/db   # Render PostgreSQL
JWT_SECRET=production-jwt-secret                   # Different from local
PORT=3002                                          # Auto-set by Render
NODE_ENV=production

# Frontend (Vercel) - Set in Vercel Dashboard  
NEXT_PUBLIC_API_URL=https://your-backend.render.com  # Production backend URL
```

#### **🔑 Critical Environment Setup**
- **JWT_SECRET**: Must be different between local/production for security
- **DATABASE_URL**: Both local and production use PostgreSQL (different servers)  
- **API_URL**: Frontend must point to correct backend (local vs production)
- **Render Auto-Deploy**: Triggered by pushes to main branch
- **Vercel Auto-Deploy**: Triggered by pushes to main branch

#### **🚨 Database Troubleshooting**

**Problem**: "Database `sales_commission_db` does not exist"
```bash
# Solution: Create the database
createdb sales_commission_db
cd backend && npx prisma migrate deploy
```

**Problem**: "Connection refused" or "Server not found"
```bash
# Solution: Start PostgreSQL service
brew services start postgresql@14
brew services list | grep postgresql  # Verify it's running
```

**Problem**: "Lost my manual data after running seed"
```bash
# This is now FIXED - seed script preserves existing data
# Your data persists across restarts and seed runs
psql -d sales_commission_db -c "SELECT email FROM users;"  # Check your data
```

**Problem**: Need to reset database completely
```bash
# WARNING: This deletes ALL data
dropdb sales_commission_db
createdb sales_commission_db
cd backend && npx prisma migrate deploy && node seed-data.js
```

### **🛠️ Development Tools & Automation**

#### **dev-tools.sh** (Root directory)
```bash
# Available commands
./dev-tools.sh new-feature "feature-name"    # Create new feature branch
./dev-tools.sh deploy-prod                   # Deploy to production
./dev-tools.sh status                        # Check git status
./dev-tools.sh cleanup                       # Clean merged branches
```

#### **Key Configuration Files**
```
# Environment Files
/frontend/.env.development     # Local frontend config
/frontend/.env.local          # Local overrides (optional)
/backend/.env                 # Local backend config

# Automation
/dev-tools.sh                 # Development workflow automation
/frontend/package.json        # Frontend dependencies & scripts
/backend/package.json         # Backend dependencies & scripts

# Database
/backend/prisma/schema.prisma # Database schema
/backend/prisma/migrations/   # Database migrations
```

#### **🚀 Quick Start After Restart**
```bash
# 1. Ensure PostgreSQL is running
brew services list | grep postgresql  # Should show "started"

# 2. Verify database exists and has data
psql -d sales_commission_db -c "SELECT COUNT(*) FROM users;"

# 3. Start backend
cd backend && node server-working.js

# 4. Start frontend (new terminal)
cd frontend && npm run dev

# 5. Access application
# Local: http://localhost:3000
# Production: https://sales-commission-saas.vercel.app/

# 6. Test login with either account
# Standard: test@company.com / password123
# Custom: tom@test.com / [your password]
```

## 🔍 **Development Notes**

### **Design Philosophy**
- **Simplicity First**: Avoid over-engineering
- **AI-Ready**: All data structured for machine learning
- **Mobile-First**: Responsive design from start
- **UK-Focused**: Currency (£), date formats, business practices
- **Modern Business App**: Professional UI with sophisticated interactions

### **Code Standards**
- TypeScript for type safety
- Component-based architecture
- Comprehensive error handling
- Activity logging for all actions
- RESTful API design
- ML training data collection patterns

### **Testing Strategy**
- Manual testing with test user account
- Frontend component testing
- API endpoint validation
- Database migration testing

## 🎨 **UI/UX Guidelines**

### **Modern Design System**
- **Colors**: Gradient-based color schemes (indigo, purple, blue primaries)
- **Effects**: Glassmorphism, backdrop blur, smooth animations
- **Typography**: Professional font hierarchy with gradient text
- **Components**: Rounded cards, gradient buttons, modern forms
- **Layout**: Sophisticated sidebar with active states

### **Deal Categorization Interface**
- **5-Column Layout**: Uncategorized → Commit → Best Case → Closed Won → Progress Meter
- **Drag & Drop**: Smooth interactions with visual feedback
- **Progress Meter**: Fundraising-style thermometer with stacked values
- **Visual Hierarchy**: Color-coded buckets with consistent styling

### **Dashboard Design**
- **Gradient Metric Cards**: 3D-style cards with trend indicators
- **Progress Visualization**: Animated circular and linear progress bars
- **Modern Layout**: Grid-based responsive design
- **Interactive Elements**: Hover effects and smooth transitions

## 📊 **Data Model Principles**

### **Deal Categorization Logic**
- **Uncategorized**: CRM-synced deals (pipeline + open status)
- **Commit**: High confidence deals (rep decision via drag-drop)
- **Best Case**: Potential upside opportunities (rep decision)
- **Closed Won**: Automatically populated from CRM status
- **Progress Calculation**: Only categorized deals count toward quota

### **ML Training Data Collection**
- **Session Tracking**: Unique session IDs for user behavior analysis
- **Categorization Events**: Timestamp, from/to categories, user context
- **Metadata**: Screen resolution, user agent, confidence levels
- **Analytics Endpoint**: `/analytics/categorization-log` for ML training

### **Commission Structure**
- **Target-Based**: Quarterly/monthly/yearly quota settings
- **Percentage Rates**: Configurable commission rates per target
- **Progress Tracking**: Visual meter showing closed + commit + best case
- **Approval Workflows**: Ready for commission approval features

### **Quota Planning Wizard**
- **4-Step Process**: Scope & Timing → Distribution → Amounts → Review
- **Flexible Targeting**: Individual, role-based, or team-wide targets
- **UK Fiscal Year**: Proper April 6 - April 5 support with smart defaults
- **Pro-Rating Logic**: Automatic quota adjustment for mid-year hires
- **Distribution Methods**: Even, seasonal, custom, or one-time targets
- **Conflict Detection**: Identifies overlapping targets (resolution UI pending)
- **Comprehensive Logging**: Full audit trail with wizard metadata

## 🔐 **Security & Compliance**

### **Authentication**
- JWT tokens with 7-day expiry
- Password hashing with bcrypt
- Role-based access control
- Session management with client-side storage

### **Data Protection**
- Activity logging for audit trails
- Secure API endpoints with validation
- Input sanitization and CORS configuration
- ML data collection with privacy considerations

## 🚀 **Deployment Considerations**

### **Frontend Build Process**
- Tailwind CSS compilation working correctly
- PostCSS configuration optimized
- Next.js Pages Router build process
- Modern browser compatibility

### **Performance Optimizations**
- React Query for efficient data fetching
- Lazy loading and code splitting ready
- Optimized re-renders with proper state management
- Smooth animations with CSS transitions

---

**Last Updated**: 2025-07-18  
**Status**: Phase 1 COMPLETE + Advanced Target Management System  
**Current Phase**: Phase 2 - Conflict resolution & grouped target display COMPLETE  
**Next Session Priority**: CRM integration implementations

## 🎯 **Key Achievements This Session**
1. ✅ **Complete Conflict Resolution System** - Modal-based conflict detection and resolution
2. ✅ **Grouped Target Display** - Role-based targets show once with expandable team members
3. ✅ **Enhanced UX** - Inactive target filtering, proper badges, improved table headers
4. ✅ **Database Schema Updates** - Added role field for proper target type tracking
5. ✅ **Advanced UI Components** - Expandable rows, chevron icons, member count badges

## 🔧 **Recent Technical Improvements (2025-07-23)**

### **✅ Cloud Deployment Fixes**
- **Google Sheets Sync Timeout**: Created dual API architecture with 60-second timeout for long operations
- **Team Aggregation 500/400 Errors**: Added database compatibility layers for production schema differences
- **API Architecture**: Standard API (10s timeout) + Long-running API (60s timeout) for sync operations
- **Error Handling**: Enhanced frontend/backend error messaging with specific HTTP status responses
- **Build Issues**: Fixed Vercel compilation errors and duplicate function declarations

### **✅ Development Workflow Enhancements**
- **Branch Strategy**: Implemented main/develop/feature workflow with automation
- **Local Environment**: Complete local development setup with proper environment variables
- **dev-tools.sh**: Created automation script for common workflow operations
- **Environment Separation**: Distinct configuration for local vs production environments

### **✅ User Experience Improvements**
- **Login Error Persistence**: Error messages persist across page refreshes until user action
- **User-Friendly Error Messages**: Context-aware error messages based on HTTP status codes
- **Error Clearing Logic**: Smart error clearing when user starts correcting input
- **Authentication Flow**: Enhanced login flow with proper success/failure feedback

### **✅ API & Database Enhancements**
- **Backward Compatibility**: Try-catch blocks for database fields that may not exist in production
- **Enhanced Logging**: Comprehensive debugging for production issue resolution
- **Request Monitoring**: Better visibility into authentication and API request flows
- **Database Query Optimization**: Efficient queries with proper error handling
- **Dual API Architecture**: 
  - Standard API (10s timeout): Regular operations like auth, team, deals
  - Long-running API (60s timeout): Sync operations, Google Sheets integration
  - Location: `/frontend/src/lib/api.ts` - `integrationsApi` module
- **Error Status Mapping**: HTTP status codes mapped to user-friendly messages
  - 401: "Invalid email or password"
  - 429: "Too many login attempts"  
  - 500+: "Server error"
  - Network: "Check your connection"

## 🔧 **Previous Technical Fixes (2025-07-21)**
- **Conflict Resolution System**: Complete modal-based conflict detection and resolution
- **Database Schema**: Added role field to targets table with proper migration
- **Target Grouping**: Smart grouping algorithm for role-based vs individual targets
- **UI Components**: Expandable table rows with chevron icons and member counts
- **API Enhancements**: Proper role storage and retrieval in target operations
- **Backend Filtering**: Admin/manager users see all targets, proper permissions
- **API Integration**: Standardized error responses and optimized queries
- **Navigation System**: Smooth client-side routing without page refreshes
- **Error Boundaries**: Comprehensive error handling at component and API levels
- **Database Performance**: Optimized team queries with Prisma groupBy operations
- **Code Organization**: Proper separation of concerns and reusable components

## 🎮 **Working Features (Fully Tested)**
- ✅ **Complete Authentication Flow**: Login → Dashboard → Team → Settings navigation
- ✅ **Team Management System**: Role-based access with modular components
- ✅ **Live Database Integration**: Real user data with proper relationships
- ✅ **Drag & Drop Deals**: Pipeline → Commit → Best Case categorization
- ✅ **Progress Tracking**: Real-time quota visualization with live calculations
- ✅ **Smooth Navigation**: Client-side routing without page refreshes
- ✅ **Error Handling**: Graceful error states and user feedback
- ✅ **Responsive Design**: Consistent across all screen sizes

## 💾 **Production-Ready Features**
- **Multi-User Support**: Real database with multiple user accounts
- **Role-Based Access**: Admin/Manager permissions for team features
- **Modular Components**: TeamMemberCard, TeamStats, TeamFilters, Modals
- **Error Boundaries**: Comprehensive error handling and recovery
- **Performance Optimized**: N+1 query fixes and batch operations
- **Security Hardened**: JWT authentication with proper validation
- **Modern UI/UX**: Smooth transitions and professional design

## 🧪 **Test Environment**
- **Login**: test@company.com / password123
- **User ID**: cmd5s3s3j00026noi626j138z (real database user)
- **Team Members**: 6 realistic users with performance data
- **Deals**: 13 test deals with proper categorization and amounts
- **Active Target**: £250,000 Q1 2025 quota with real progress tracking
- **Navigation**: Smooth transitions between all pages without refreshes

---

**Last Updated**: 2025-07-23  
**Status**: Phase 1 COMPLETE + Cloud Deployment + Development Workflow + Enhanced UX  
**Current Phase**: Phase 2 - Local/Cloud development workflow with enhanced error handling  
**Next Session Priority**: Continue feature development with new workflow

## 🎯 **Key Achievements Today (2025-07-23)**
1. ✅ **Cloud Deployment Resolution** - Fixed Google Sheets sync timeout and team aggregation 500/400 errors
2. ✅ **Development Workflow Setup** - Branch-based development (main/develop/feature) with automation tools
3. ✅ **Local Development Environment** - Complete local setup with proper environment configuration
4. ✅ **Enhanced Login UX** - Persistent error messages and user-friendly authentication feedback
5. ✅ **API Timeout Architecture** - Dual API instances for standard vs long-running operations
6. ✅ **Database Compatibility** - Backward compatibility layers for production vs development schemas
7. ✅ **Production Issue Fixes** - Resolved all reported cloud deployment issues

### **🔥 Specific Issues Resolved Today**
- **"timeout of 10000ms exceeded" during Google Sheets sync** → Fixed with longRunningApi (60s timeout)
- **Team aggregated-target endpoint returning 500 errors** → Fixed with database compatibility layers
- **Team aggregated-target endpoint returning 400 errors** → Enhanced validation and error debugging
- **Vercel build failure due to duplicate getIntegrationIcon** → Removed duplicate function declarations
- **Frontend unable to authenticate locally** → Fixed environment variable loading and server restart
- **Login errors disappearing on page refresh** → Implemented localStorage-based error persistence
- **Generic "Login failed" messages** → Added specific error messages based on HTTP status codes

## 🎯 **Previous Session Achievements (2025-07-21)**
1. ✅ **Advanced Team Performance System** - Period filtering with Monthly/Quarterly/Yearly toggles
2. ✅ **Three-Tier Progress Visualization** - Closed/Commit/Best Case stacked progress bars consistent with deals page logic  
3. ✅ **Smart Deal Filtering** - Date-based filtering for accurate period reporting
4. ✅ **Pro-rated Quota Calculations** - Simple division logic (£480K → £120K → £40K)
5. ✅ **Google Sheets Integration** - Real-time sync with template downloads and user assignment
6. ✅ **Enhanced Backend Architecture** - Optimized queries with deal categorization support

## 🔧 **Technical Achievements Completed**
- **Period-Based Team Analytics**: Complete filtering system with pro-rated quota calculations
- **Deal Categorization Integration**: Backend queries for commit/best case deals with proper date filtering
- **Google Sheets Real-time Integration**: CSV export access with column mapping and data preview
- **Enhanced Progress Visualization**: Three-tier stacked progress bars with 2x2 grid legend
- **Performance Optimization**: Batch queries with lookup maps for efficient team data loading
- **Frontend/Backend Sync**: Updated TypeScript interfaces and API endpoints for new data structure

## 🎮 **Working Features (Production-Ready)**
- ✅ **Complete Team Performance Analytics**: Period filtering, progress visualization, quota tracking
- ✅ **Google Sheets Integration**: Real-time data sync with template downloads and user assignment  
- ✅ **Advanced Quota System**: Pro-rated calculations with period-aware display
- ✅ **Deal Categorization Logic**: Consistent with deals page logic (closed/commit/best case count toward quota)
- ✅ **Responsive Team Management**: Role-based access with modular component architecture
- ✅ **Real-time Data**: Live database integration with proper relationships and performance metrics