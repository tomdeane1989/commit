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

## 🏃‍♂️ **Development Servers**

### **Backend**
```bash
cd backend
node server-working.js  # Port 3002
```

### **Frontend**
```bash
cd frontend
npm run dev  # Port 3000 (may auto-change if occupied)
```

### **Database**
```bash
# Run migrations
cd backend
npm run migrate

# Generate Prisma client
npm run generate

# Populate with test data
npm run seed
```

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

### **Environment Variables**
- Backend: DATABASE_URL, JWT_SECRET, PORT=3002
- Frontend: NEXT_PUBLIC_API_URL=http://localhost:3002

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

## 🔧 **Technical Fixes Completed**
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

**Last Updated**: 2025-07-21  
**Status**: Phase 1 COMPLETE + Advanced Team Performance System + Google Sheets Integration  
**Current Phase**: Phase 2 - Team performance analytics and CRM integrations  
**Next Session Priority**: Salesforce/HubSpot/Pipedrive integration implementations

## 🎯 **Key Achievements This Session**
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