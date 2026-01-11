import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { login } from '@/lib/api';
import { Spade, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success && result.data) {
      setAuth(result.data.token, result.data.user);
      navigate('/');
    } else {
      setError(result.error || 'Login failed');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decorations */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, hsl(43 96% 56% / 0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, hsl(345 45% 30% / 0.05) 0%, transparent 50%)
          `,
        }}
      />

      <div className="w-full max-w-md animate-scale-in">
        {/* Card */}
        <div
          className="rounded-3xl p-8 space-y-8"
          style={{
            background: 'linear-gradient(135deg, hsl(240 15% 10%) 0%, hsl(240 15% 6%) 100%)',
            border: '1px solid hsl(32 94% 44% / 0.2)',
            boxShadow: `
              0 25px 80px rgba(0, 0, 0, 0.5),
              0 0 60px hsl(32 94% 44% / 0.05),
              inset 0 1px 0 hsl(32 94% 44% / 0.1)
            `,
          }}
        >
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
                style={{
                  background: 'linear-gradient(135deg, hsl(43 96% 56%) 0%, hsl(32 94% 44%) 100%)',
                  boxShadow: '0 8px 32px hsl(32 94% 44% / 0.4)',
                }}
              >
                <Spade className="w-8 h-8 text-gray-900" />
              </div>
            </div>
            <h1 className="text-3xl font-display gold-text-gradient mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-500">
              Sign in to continue playing
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="p-4 rounded-xl text-sm animate-fade-in"
                style={{
                  background: 'linear-gradient(135deg, hsl(0 70% 20% / 0.3) 0%, hsl(0 70% 15% / 0.2) 100%)',
                  border: '1px solid hsl(0 60% 40% / 0.3)',
                  color: 'hsl(0 70% 65%)',
                }}
              >
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">
                Email
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-100 placeholder-gray-600 transition-all duration-200 focus-gold"
                  style={{
                    background: 'hsl(240 15% 8%)',
                    border: '1px solid hsl(240 12% 20%)',
                  }}
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-100 placeholder-gray-600 transition-all duration-200 focus-gold"
                  style={{
                    background: 'hsl(240 15% 8%)',
                    border: '1px solid hsl(240 12% 20%)',
                  }}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-luxury btn-gold py-4 flex items-center justify-center gap-2 text-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span className="font-semibold">Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-gray-800/50">
            <p className="text-gray-500">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="gold-text hover:underline font-medium inline-flex items-center gap-1"
              >
                Sign up
                <Sparkles className="w-3 h-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
