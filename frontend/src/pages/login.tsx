import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Load persisted error on component mount
  useEffect(() => {
    const persistedError = localStorage.getItem('loginError');
    if (persistedError) {
      setError(persistedError);
    }
  }, []);

  // Handle input changes without clearing errors
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    localStorage.removeItem('loginError'); // Clear any existing error
    setLoading(true);

    try {
      await login(email, password);
      // Success - clear any persisted error
      localStorage.removeItem('loginError');
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      // Persist error so it survives page refresh
      localStorage.setItem('loginError', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-gray-50 to-white px-6 py-12 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <img 
            src="/commit_logo2.png" 
            alt="Logo" 
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold text-gray-900">Sign in to your account</h1>
          <p className="mt-1 text-sm text-gray-500">Sales Performance Platform</p>
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
                onChange={handleEmailChange}
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
                  onChange={handlePasswordChange}
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
            <Link
              href="/register"
              className="font-medium hover:opacity-80 transition"
              style={{ color: '#82a365' }}
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};



export default LoginPage;