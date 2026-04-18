import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface InputProps {
  label?: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  icon?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  error?: string;
  maxLength?: number;
  name?: string;
}

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  icon: Icon,
  fullWidth = false,
  disabled = false,
  required = false,
  className = '',
  error,
  maxLength,
  name
}: InputProps) {
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <div className={`space-y-2 ${widthClass}`}>
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            w-full px-4 py-3 rounded-lg border border-gray-700 bg-gray-800 text-white 
            placeholder-gray-400 focus:border-red-500 focus:ring-red-500/20 
            focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed
            ${Icon ? 'pl-10' : ''}
            ${className}
          `}
          maxLength={maxLength}
          name={name}
        />
      </div>
    </div>
  );
}