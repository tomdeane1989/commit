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
- ✅ Authentication system (register/login/logout)
- ✅ Modern dashboard with sophisticated UI
- ✅ Backend API with all core endpoints
- ✅ **Drag-and-drop deal categorization interface**
- ✅ **Target setting and management system**
- ✅ **Fundraising-style quota progress meter**
- ✅ **ML training data collection for categorization**
- ✅ Modern business application UI with gradients and animations
- ✅ Responsive design across all devices

### **🔄 Working Features**
- User registration and authentication with modern UI
- Dashboard with gradient metric cards and progress visualization
- **5-column deal categorization layout:**
  - Pipeline (CRM synced deals - default state)
  - Commit bucket (drag-and-drop target for high confidence deals)
  - Best Case bucket (drag-and-drop target for speculative deals)
  - Closed Won (reference/display only)
  - Progress meter (stacked quota visualization)
- **Drag-and-drop deal categorization** - smooth single-motion workflow
- Commission calculations with visual progress tracking and correct amounts
- Target creation/editing with multiple period types (monthly/quarterly/yearly)
- Protected routes and JWT auth
- Session tracking for ML data collection
- **Comprehensive seed data** with realistic UK B2B deal scenarios

### **🎨 Modern UI Features**
- Glassmorphism effects with backdrop blur
- Gradient backgrounds and sophisticated color schemes
- Professional sidebar with active state indicators
- Animated progress meters and smooth transitions
- Responsive card layouts with hover effects
- Modern form inputs and interactive elements

### **⚠️ Next Phase Priorities**
- CRM sync implementations (placeholders exist)
- Team management features
- Commission approval workflows
- Advanced reporting and analytics

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
  ├── prisma/schema.prisma     # Database schema
  ├── routes/                  # API endpoints
  ├── middleware/             # Auth and error handling
  ├── server-working.js       # Main server file
  └── .env                    # Environment variables

/frontend/
  ├── src/pages/              # Pages Router pages
  │   ├── dashboard.tsx       # Modern dashboard with metrics
  │   ├── deals/index.tsx     # 5-column categorization interface
  │   └── settings.tsx        # Target management system
  ├── src/components/         # Reusable components
  │   └── layout.tsx          # Modern sidebar with glassmorphism
  ├── src/hooks/              # Custom React hooks
  ├── src/lib/                # API client and utilities
  ├── src/types/              # TypeScript definitions
  └── src/styles/             # Global CSS and Tailwind
      └── globals.css         # FIXED: Proper Tailwind imports
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

**Last Updated**: 2025-07-16  
**Status**: Phase 1 COMPLETE + Enhancements - Core functionality with working drag-and-drop  
**Current Phase**: Phase 2 - Advanced deal management features  
**Next Session Priority**: CRM integration and team management features

## 🎯 **Key Achievements This Session**
1. ✅ **Added comprehensive seed data** - 13 realistic test deals with proper categorization
2. ✅ **Fixed drag-and-drop functionality** - Smooth single-motion deal categorization working
3. ✅ **Implemented realistic CRM sync workflow** - Pipeline → Commit/Best Case logic
4. ✅ **Updated deal categorization logic** - Changed "Uncategorized" to "Pipeline" 
5. ✅ **Fixed backend API endpoints** - Complete `/deals/:id/categorize` implementation
6. ✅ **Resolved string concatenation bugs** - Proper numeric amount calculations
7. ✅ **Added targets API endpoint** - Fixed 404 errors for quota management

## 🔧 **Technical Fixes Completed**
- **Database Integration**: Deal categorizations now properly stored/retrieved
- **API Endpoints**: Working categorization endpoint with ML logging  
- **Frontend State Management**: Simplified drag-and-drop without Fast Refresh errors
- **Numeric Calculations**: Fixed Decimal-to-number conversion issues
- **Realistic Workflow**: Most deals start in Pipeline for manual categorization

## 🎮 **Working Features (Tested)**
- ✅ **Seed Data Script**: `npm run seed` creates realistic test data
- ✅ **Drag & Drop**: Move deals between Pipeline → Commit → Best Case
- ✅ **Progress Meter**: Real-time quota visualization with correct amounts
- ✅ **Deal Categorization**: Backend persistence with ML training logs
- ✅ **Amount Calculations**: Proper sum totals in bucket headers
- ✅ **Targets API**: Quota management endpoints working

## 💾 **Test Data Ready**
- **Login**: test@company.com / password123
- **13 Test Deals**: 3 closed, 8 pipeline, 1 commit, 1 best case
- **Active Target**: £250,000 Q1 2025 quota
- **Commission History**: Historical Q4 2024 commissions