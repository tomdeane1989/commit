#!/bin/bash

# Sales Commission SaaS - Development Tools
# Quick commands for common development tasks

case "$1" in
  "new-feature")
    if [ -z "$2" ]; then
      echo "Usage: ./dev-tools.sh new-feature <feature-name>"
      echo "Example: ./dev-tools.sh new-feature fix-sync-timeout"
      exit 1
    fi
    echo "🚀 Creating new feature branch: feature/$2"
    git checkout develop
    git pull origin develop
    git checkout -b "feature/$2"
    echo "✅ Ready to work on feature/$2"
    ;;
    
  "start-dev")
    echo "🔧 Starting local development servers..."
    echo "Backend will start on http://localhost:3002"
    echo "Frontend will start on http://localhost:3000"
    echo ""
    echo "Opening terminals for backend and frontend..."
    
    # macOS - open new terminal tabs
    if [[ "$OSTYPE" == "darwin"* ]]; then
      osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/backend\" && node server-working.js"'
      osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/frontend\" && npm run dev"'
    else
      echo "Please run these commands in separate terminals:"
      echo "1. cd backend && node server-working.js"
      echo "2. cd frontend && npm run dev"
    fi
    ;;
    
  "deploy-dev")
    echo "📤 Pushing current feature to develop branch..."
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ $CURRENT_BRANCH == feature/* ]]; then
      git push origin "$CURRENT_BRANCH"
      git checkout develop
      git merge "$CURRENT_BRANCH"
      git push origin develop
      echo "✅ Feature merged to develop branch"
    else
      echo "❌ Not on a feature branch. Current branch: $CURRENT_BRANCH"
      exit 1
    fi
    ;;
    
  "deploy-prod")
    echo "🚀 Deploying to production..."
    git checkout main
    git merge develop
    git push origin main
    echo "✅ Deployed to production (Vercel + Render will build automatically)"
    echo "🔗 Frontend: https://commit-snowy.vercel.app"
    echo "🔗 Backend: https://commit-5moi.onrender.com"
    ;;
    
  "status")
    echo "📊 Development Status"
    echo "==================="
    echo "Current branch: $(git branch --show-current)"
    echo "Local changes: $(git status --porcelain | wc -l | tr -d ' ') files"
    echo ""
    echo "Recent commits on current branch:"
    git log --oneline -5
    ;;
    
  "clean")
    echo "🧹 Cleaning up merged feature branches..."
    git checkout develop
    git branch --merged | grep "feature/" | xargs -n 1 git branch -d
    echo "✅ Cleaned up merged feature branches"
    ;;
    
  *)
    echo "Sales Commission SaaS - Development Tools"
    echo "========================================"
    echo ""
    echo "Usage: ./dev-tools.sh <command>"
    echo ""
    echo "Commands:"
    echo "  new-feature <name>  Create new feature branch"
    echo "  start-dev          Start local development servers"
    echo "  deploy-dev         Push feature to develop branch"
    echo "  deploy-prod        Deploy develop to production"
    echo "  status             Show current development status"
    echo "  clean              Clean up merged feature branches"
    echo ""
    echo "Examples:"
    echo "  ./dev-tools.sh new-feature fix-sync-timeout"
    echo "  ./dev-tools.sh start-dev"
    echo "  ./dev-tools.sh deploy-prod"
    ;;
esac