// src/components/Layout.tsx
import React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import VersionDisplay from './VersionDisplay';
import { 
  Home, 
  BarChart3, 
  PoundSterling, 
  Users, 
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Search,
  Filter,
  MoreHorizontal,
  Menu,
  X,
  Link
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const DateDisplay = () => {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return <span>Loading...</span>;
  }
  
  return (
    <span>
      {new Date().toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}
    </span>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile menu when route changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  const navigation = [
    { name: 'Forecasting', href: '/deals', icon: BarChart3 },
    { name: 'Performance', href: '/commissions', icon: PoundSterling },
    { name: 'Team', href: '/team', icon: Users, adminOnly: true },
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const filteredNavigation = navigation.filter(item => {
    // Always show non-admin items
    if (!item.adminOnly) return true;
    
    // For admin-only items, check if user has proper permissions
    // If user is not loaded yet, temporarily show the item to prevent flashing
    if (!user) return true;
    
    return user.role === 'manager';
  });

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 lg:flex">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-2xl transform transition-transform duration-300 lg:relative lg:transform-none lg:z-10 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-20 px-8 border-b border-gray-200/50">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-lg shadow-lg flex items-center justify-center">
                <img 
                  src="/commit_logo2.png" 
                  alt="Commit Logo" 
                  className="w-11 h-11 object-contain"
                />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-green-800" style={{ fontFamily: 'Calibri, sans-serif' }}>
                  Commit
                </h1>
                <p className="text-xs text-gray-500 font-medium">Own Your Number</p>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-6 py-8 space-y-2">
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Main Menu
              </h3>
            </div>
            {filteredNavigation.map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-sm font-medium rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                    isActive 
                      ? 'text-white shadow-lg' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  style={isActive ? { 
                    background: `linear-gradient(to right, #82a365, #6b8950)`,
                    boxShadow: '0 10px 15px -3px rgba(56, 64, 49, 0.25)'
                  } : {}}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-xl mr-4 transition-all duration-300 ${
                      isActive 
                        ? 'bg-white/20' 
                        : 'bg-gray-100 group-hover:bg-gray-200'
                    }`}>
                      <item.icon className={`w-5 h-5 ${
                        isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-700'
                      }`} />
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-white/70" />
                  )}
                  {isActive && (
                    <div className="absolute inset-0 opacity-20 rounded-2xl" style={{ background: 'linear-gradient(to right, #82a365, #6b8950)' }}></div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-6 border-t border-gray-200/50">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ background: 'linear-gradient(to bottom right, #82a365, #6b8950)' }}>
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize font-medium">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            
            {/* Footer with text logo */}
            <div className="mt-4 flex justify-center">
              <img 
                src="/commit_logo2.png" 
                alt="Commit" 
                className="h-6 opacity-40 hover:opacity-60 transition-opacity duration-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 lg:flex lg:flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="flex items-center justify-between h-20 px-4 lg:px-8">
            <div className="flex items-center space-x-4 lg:space-x-6">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              {/* Search - hidden on small screens, responsive on larger */}
              <div className="hidden sm:block relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search deals, performance, team..."
                  className="block w-64 lg:w-96 pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300"
                  style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}
                />
              </div>
              
            </div>
            <div className="flex items-center space-x-2 lg:space-x-4">
              {/* Filter button - hidden on mobile */}
              <button className="hidden sm:block p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-300">
                <Filter className="w-5 h-5" />
              </button>
              
              {/* Notifications */}
              <button className="relative p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-300">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              {/* Divider - hidden on mobile */}
              <div className="hidden lg:block h-8 w-px bg-gray-200"></div>
              
              {/* Date display - hidden on mobile */}
              <div className="hidden lg:flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
                <div className="text-sm font-medium text-gray-700">
                  <DateDisplay />
                </div>
              </div>
              
              {/* More menu - hidden on mobile */}
              <button className="hidden sm:block p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-300">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
      
      {/* Version Display */}
      <VersionDisplay />
    </div>
  );
};

export default Layout;