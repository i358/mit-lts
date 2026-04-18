import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
  const baseClasses = 'bg-gray-950/80 backdrop-blur-sm border border-gray-800/50 rounded-xl shadow-lg';
  const hoverClasses = hover ? 'hover:shadow-xl hover:border-gray-700/50 transition-all duration-300 cursor-pointer' : '';
  const classes = `${baseClasses} ${hoverClasses} ${className}`;

  if (onClick) {
    return (
      <motion.div
        className={classes}
        onClick={onClick}
        whileHover={hover ? { y: -2 } : {}}
        whileTap={hover ? { scale: 0.98 } : {}}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={classes}>
      {children}
    </div>
  );
}