// src/components/Layout.tsx
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  Plus,
  Filter,
  MoreHorizontal
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
  const [currentPath, setCurrentPath] = React.useState('/dashboard');

  React.useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Deals', href: '/deals', icon: BarChart3 },
    { name: 'Commissions', href: '/commissions', icon: PoundSterling },
    { name: 'Team', href: '/team', icon: Users, adminOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const filteredNavigation = navigation.filter(item => 
    !item.adminOnly || (user?.role === 'admin' || user?.role === 'manager')
  );

  const handleNavigation = (href: string) => {
    setCurrentPath(href);
    window.location.href = href;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-80 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-20 px-8 border-b border-gray-200/50">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <PoundSterling className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  SalesComm
                </h1>
                <p className="text-xs text-gray-500 font-medium">Enterprise Edition</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-6 py-8 space-y-2">
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Main Menu
              </h3>
            </div>
            {filteredNavigation.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-sm font-medium rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
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
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-20 rounded-2xl"></div>
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
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-lg">
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
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-80">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="flex items-center justify-between h-20 px-8">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search deals, commissions, team..."
                  className="block w-96 pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                />
              </div>
              <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/25">
                <Plus className="w-4 h-4 mr-2" />
                New Deal
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-300">
                <Filter className="w-5 h-5" />
              </button>
              <button className="relative p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-300">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="h-8 w-px bg-gray-200"></div>
              <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
                <div className="text-sm font-medium text-gray-700">
                  <DateDisplay />
                </div>
              </div>
              <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-300">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;