import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { LogOut, User, Coins, Spade } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'linear-gradient(180deg, hsl(240 15% 6% / 0.98) 0%, hsl(240 15% 6% / 0.95) 100%)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid hsl(32 94% 44% / 0.15)',
        }}
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 group"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, hsl(43 96% 56%) 0%, hsl(32 94% 44%) 100%)',
                boxShadow: '0 4px 12px hsl(32 94% 44% / 0.3)',
              }}
            >
              <Spade className="w-5 h-5 text-gray-900" />
            </div>
            <span className="text-2xl font-display gold-text-gradient">
              Poker
            </span>
          </Link>

          {/* User info & actions */}
          {user && (
            <div className="flex items-center gap-6">
              {/* Balance */}
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, hsl(43 96% 56% / 0.1) 0%, hsl(43 96% 56% / 0.05) 100%)',
                  border: '1px solid hsl(43 96% 56% / 0.2)',
                }}
              >
                <Coins className="w-4 h-4 gold-text" />
                <span className="font-semibold gold-text">
                  {user.balance.toLocaleString()}
                </span>
                <span className="text-gray-500 text-sm">chips</span>
              </div>

              {/* Username */}
              <div className="flex items-center gap-2 text-gray-400">
                <User className="w-4 h-4" />
                <span className="font-medium text-gray-200">{user.username}</span>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-gray-200 transition-all duration-200 hover:bg-gray-800/50"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
