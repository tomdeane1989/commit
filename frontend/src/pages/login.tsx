import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleTestLogin = () => {
    setEmail('test@company.com');
    setPassword('password123');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-gray-50 to-white px-6 py-12 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Sign in to your account</h1>
          <p className="mt-1 text-sm text-gray-500">Sales Commission Management Platform</p>
        </div>

        {/* Test Account Box */}
        <div className="rounded-lg border px-4 py-3" style={{ borderColor: '#82a365', backgroundColor: '#f8f9f4' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium" style={{ color: '#82a365' }}>Test Account</h3>
              <p className="text-xs" style={{ color: '#6b8950' }}>Use these credentials to explore the product</p>
            </div>
            <button
              type="button"
              onClick={handleTestLogin}
              className="text-xs font-medium text-white px-3 py-1 rounded-md transition hover:opacity-90"
              style={{ backgroundColor: '#82a365' }}
            >
              Use Test Account
            </button>
          </div>
          <div className="mt-2 text-xs space-y-1" style={{ color: '#82a365' }}>
            <div><strong>Email:</strong> test@company.com</div>
            <div><strong>Password:</strong> password123</div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:outline-none transition"
                style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:outline-none transition"
                  style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: '#82a365' }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-gray-500 pt-2">
            Don't have an account?{' '}
            <a
              href="/register"
              className="font-medium hover:opacity-80 transition"
              style={{ color: '#82a365' }}
            >
              Sign up
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};



export default LoginPage;