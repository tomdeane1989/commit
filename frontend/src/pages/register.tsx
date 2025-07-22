import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { 
  Building2, 
  User, 
  Mail, 
  Lock, 
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface RegisterFormData {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  company_domain?: string;
  password: string;
  confirmPassword: string;
}

const RegisterPage = () => {
  const router = useRouter();
  const { setUser } = useAuth();
  const [formData, setFormData] = useState<RegisterFormData>({
    first_name: '',
    last_name: '',
    email: '',
    company_name: '',
    company_domain: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterFormData, 'confirmPassword'>) => {
      const response = await authApi.register(data);
      return response;
    },
    onSuccess: (data) => {
      // Store token and user data
      localStorage.setItem('token', data.token);
      setUser(data.user);
      
      // Redirect to dashboard
      router.push('/dashboard');
    },
    onError: (error: any) => {
      console.error('Registration error:', error);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response?.status === 400) {
        const serverError = error.response?.data?.error || error.response?.data?.message;
        
        if (serverError === 'User already exists') {
          errorMessage = 'An account with this email address already exists.';
        } else {
          errorMessage = serverError || 'Please check your information and try again.';
        }
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      }
      
      setValidationErrors({
        submit: errorMessage
      });
    }
  });

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }
    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.company_name.trim()) {
      errors.company_name = 'Company name is required';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const { confirmPassword, ...registerData } = formData;
    registerMutation.mutate(registerData);
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // Clear submit error when email field changes (in case of "user exists" error)
    if (name === 'email' && validationErrors.submit) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.submit;
        return newErrors;
      });
    }
  };

  // Password strength checker
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="min-h-screen bg-gradient-to-tr from-gray-50 to-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#82a365' }}>
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Start Your Commission Tracking Journey
          </h1>
          <p className="text-gray-600 max-w-md mx-auto">
            Create your account and get started with professional commission tracking for your sales team
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" style={{ color: '#82a365' }} />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition"
                    style={validationErrors.first_name 
                      ? { borderColor: '#ef4444', '--tw-ring-color': '#fecaca' } 
                      : { '--tw-ring-color': '#82a365' } as React.CSSProperties
                    }
                    placeholder="Enter your first name"
                  />
                  {validationErrors.first_name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.first_name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition"
                    style={validationErrors.last_name 
                      ? { borderColor: '#ef4444', '--tw-ring-color': '#fecaca' } 
                      : { '--tw-ring-color': '#82a365' } as React.CSSProperties
                    }
                    placeholder="Enter your last name"
                  />
                  {validationErrors.last_name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.last_name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2" style={{ color: '#82a365' }} />
                Contact Information
              </h3>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition"
                  style={validationErrors.email 
                    ? { borderColor: '#ef4444', '--tw-ring-color': '#fecaca' } 
                    : { '--tw-ring-color': '#82a365' } as React.CSSProperties
                  }
                  placeholder="Enter your email address"
                />
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {validationErrors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Company Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Building2 className="w-5 h-5 mr-2" style={{ color: '#82a365' }} />
                Company Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition"
                    style={validationErrors.company_name 
                      ? { borderColor: '#ef4444', '--tw-ring-color': '#fecaca' } 
                      : { '--tw-ring-color': '#82a365' } as React.CSSProperties
                    }
                    placeholder="Enter your company name"
                  />
                  {validationErrors.company_name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.company_name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="company_domain" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Website <span className="text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="company_domain"
                    name="company_domain"
                    value={formData.company_domain}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition"
                    style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}
                    placeholder="www.yourcompany.com"
                  />
                </div>
              </div>
            </div>

            {/* Security */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Lock className="w-5 h-5 mr-2" style={{ color: '#82a365' }} />
                Security
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition"
                      style={validationErrors.password 
                        ? { borderColor: '#ef4444', '--tw-ring-color': '#fecaca' } 
                        : { '--tw-ring-color': '#82a365' } as React.CSSProperties
                      }
                      placeholder="Create a secure password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Password strength:</span>
                        <span className={`font-medium ${
                          passwordStrength <= 2 ? 'text-red-600' : 
                          passwordStrength === 3 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {strengthLabels[passwordStrength - 1] || strengthLabels[0]}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${strengthColors[passwordStrength - 1] || strengthColors[0]}`}
                          style={{ width: `${(passwordStrength / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {validationErrors.password && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.password}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition"
                      style={validationErrors.confirmPassword 
                        ? { borderColor: '#ef4444', '--tw-ring-color': '#fecaca' } 
                        : formData.confirmPassword && formData.password === formData.confirmPassword
                        ? { borderColor: '#22c55e', '--tw-ring-color': '#bbf7d0' }
                        : { '--tw-ring-color': '#82a365' } as React.CSSProperties
                      }
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="mt-1 text-sm text-green-600 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Passwords match
                    </p>
                  )}
                  {validationErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {validationErrors.submit && (
              <div className={`p-4 border rounded-lg ${
                validationErrors.submit.includes('already exists')
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`flex items-center ${
                  validationErrors.submit.includes('already exists')
                    ? 'text-blue-700'
                    : 'text-red-700'
                }`}>
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {validationErrors.submit}
                </p>
                {validationErrors.submit.includes('already exists') && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Link 
                      href="/login" 
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-lg transition hover:opacity-90"
                      style={{ backgroundColor: '#82a365' }}
                    >
                      Sign in to existing account
                    </Link>
                    <span className="text-blue-600 text-sm self-center">or try a different email address</span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full flex justify-center items-center px-4 py-3 text-sm font-medium text-white rounded-lg transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: '#82a365' }}
            >
              {registerMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>

            {/* Login Link */}
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="font-medium hover:opacity-80 transition" style={{ color: '#82a365' }}>
                  Sign in here
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Features Preview */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">What you'll get with your account:</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
            <span className="bg-white border border-gray-200 px-3 py-1 rounded-full">✓ Team Performance Tracking</span>
            <span className="bg-white border border-gray-200 px-3 py-1 rounded-full">✓ CRM Integration</span>
            <span className="bg-white border border-gray-200 px-3 py-1 rounded-full">✓ Commission Analytics</span>
            <span className="bg-white border border-gray-200 px-3 py-1 rounded-full">✓ Quota Management</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;