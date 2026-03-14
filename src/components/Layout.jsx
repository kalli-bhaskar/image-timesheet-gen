import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Home, Clock, FileText, Users, LogOut, Settings } from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isManager = user?.user_role === 'manager';

  if (!user) return null;

  const navItems = isManager
    ? [
        { path: '/Dashboard', icon: Home, label: 'Home' },
        { path: '/Employees', icon: Users, label: 'Team' },
        { path: '/Timesheets', icon: FileText, label: 'Sheets' },
        { path: '/Settings', icon: Settings, label: 'Settings' },
      ]
    : [
        { path: '/Dashboard', icon: Home, label: 'Home' },
        { path: '/ClockAction', icon: Clock, label: 'Clock' },
        { path: '/MyTimesheets', icon: FileText, label: 'Sheets' },
        { path: '/Settings', icon: Settings, label: 'Settings' },
      ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-wide">TimeTrack</span>
        </div>
        <button
          onClick={() => logout(false)}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
        </button>
      </header>

      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1 z-50 safe-area-bottom">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all ${
                  active
                    ? 'text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}