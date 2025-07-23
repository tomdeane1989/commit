# Development Workflow Guide

## 🌟 **Branch Strategy**

- **`main`** → Production branch (auto-deploys to Vercel + Render)
- **`develop`** → Development/staging branch for local testing
- **`feature/*`** → Individual feature branches

## 🚀 **Daily Workflow**

### 1. **Starting New Work**
```bash
# Switch to develop and pull latest
git checkout develop
git pull origin develop

# Create new feature branch
git checkout -b feature/your-feature-name
```

### 2. **Local Development & Testing**
```bash
# Make changes and test locally
# Backend: cd backend && node server-working.js
# Frontend: cd frontend && npm run dev

# Commit frequently
git add .
git commit -m "Your commit message"
```

### 3. **Ready for Production Deploy**
```bash
# Push feature branch
git push origin feature/your-feature-name

# Switch to develop and merge
git checkout develop
git merge feature/your-feature-name
git push origin develop

# When ready for production
git checkout main
git merge develop
git push origin main  # This triggers production deployment
```

## 🛠 **Quick Commands**

### Create Feature Branch
```bash
git checkout develop
git pull origin develop
git checkout -b feature/fix-sync-timeout
```

### Local Testing Environment
```bash
# Terminal 1: Backend
cd backend
node server-working.js

# Terminal 2: Frontend  
cd frontend
npm run dev
```

### Deploy to Production
```bash
git checkout main
git merge develop
git push origin main
```

## 🔧 **Environment Setup**

### Local Development
- **Backend**: `http://localhost:3002`
- **Frontend**: `http://localhost:3000`
- **Database**: Local PostgreSQL or production DB

### Production Deployment
- **Backend**: `https://commit-5moi.onrender.com`
- **Frontend**: `https://commit-snowy.vercel.app`
- **Database**: Production PostgreSQL on Render

## 📋 **Best Practices**

1. **Always work on feature branches** - never commit directly to `main`
2. **Test thoroughly locally** before merging to `develop`
3. **Keep commits small and focused** with clear messages
4. **Pull latest develop** before creating new feature branches
5. **Delete feature branches** after merging to keep repo clean

## 🚨 **Emergency Hotfixes**

For urgent production fixes:
```bash
git checkout main
git checkout -b hotfix/urgent-fix
# Make minimal fix
git checkout main
git merge hotfix/urgent-fix
git push origin main
```

## 🎯 **Current Status**

- ✅ **`develop` branch created** and pushed to GitHub
- ✅ **Local development environment** ready
- ✅ **Production deployment** remains on `main` branch
- ⏳ **Next**: Create feature branches for new work

---

**Note**: This workflow eliminates waiting for Render/Vercel builds during development while maintaining clean production deployments.