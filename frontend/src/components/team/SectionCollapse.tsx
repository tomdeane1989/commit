// SectionCollapse.tsx - Reusable collapsible section component
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface SectionCollapseProps {
  title: string;
  number?: number;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  validated?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  defaultOpen?: boolean;
  info?: string;
  className?: string;
}

const SectionCollapse: React.FC<SectionCollapseProps> = ({
  title,
  number,
  children,
  required = false,
  optional = false,
  validated = false,
  hasError = false,
  errorMessage,
  defaultOpen = false,
  info,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Section Header */}
      <button
        type="button"
        onClick={toggleOpen}
        className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
          isOpen
            ? 'bg-gradient-to-r from-green-50 to-white border-b border-gray-200'
            : 'bg-white hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center space-x-3">
          {/* Expand/Collapse Icon */}
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-600" />
          )}

          {/* Section Number */}
          {number && (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                validated
                  ? 'bg-green-600 text-white'
                  : hasError
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {validated ? <CheckCircle className="w-4 h-4" /> : number}
            </div>
          )}

          {/* Title */}
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-semibold text-gray-900">
              {title}
            </h3>
            {required && (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Required
              </span>
            )}
            {optional && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                Optional
              </span>
            )}
          </div>
        </div>

        {/* Status Icons */}
        <div className="flex items-center space-x-2">
          {info && !isOpen && (
            <Info className="w-4 h-4 text-blue-500" />
          )}
          {validated && !isOpen && (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          {hasError && !isOpen && (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
        </div>
      </button>

      {/* Section Content */}
      {isOpen && (
        <div className="p-4 bg-white">
          {/* Info Banner */}
          {info && (
            <div className="mb-4 flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">{info}</p>
            </div>
          )}

          {/* Error Banner */}
          {hasError && errorMessage && (
            <div className="mb-4 flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}

          {/* Children Content */}
          <div>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionCollapse;
