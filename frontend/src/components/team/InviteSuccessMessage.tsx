import React, { useState } from 'react';
import { CheckCircle, Copy, Check, X, Mail, Key } from 'lucide-react';

interface InviteSuccessMessageProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  tempPassword: string;
}

export const InviteSuccessMessage: React.FC<InviteSuccessMessageProps> = ({
  isOpen,
  onClose,
  email,
  tempPassword
}) => {
  const [emailCopied, setEmailCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const copyToClipboard = async (text: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      
      if (type === 'email') {
        setEmailCopied(true);
        setTimeout(() => setEmailCopied(false), 2000);
      } else {
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (type === 'email') {
        setEmailCopied(true);
        setTimeout(() => setEmailCopied(false), 2000);
      } else {
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 2000);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Team Member Invited!</h3>
              <p className="text-sm text-gray-600">Share these credentials with the new team member</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono">
                {email}
              </div>
              <button
                onClick={() => copyToClipboard(email, 'email')}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  emailCopied 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {emailCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Temporary Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Key className="w-4 h-4 inline mr-1" />
              Temporary Password
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono">
                {tempPassword}
              </div>
              <button
                onClick={() => copyToClipboard(tempPassword, 'password')}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  passwordCopied 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {passwordCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Important:</strong> Please share these login credentials with the new team member. 
              They can use these to log in and should change their password on first login.
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-white font-medium rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: '#82a365' }}
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};