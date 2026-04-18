import { cn } from '../../utils/cn';

interface BadgeProps {
  variant?: 'soon' | 'beta' | 'destructive';
  className?: string;
  children?: React.ReactNode;
}

const variantClasses = {
  soon: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  beta: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
};

export function Badge({ variant = 'beta', className, children }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 ml-2 text-xs font-medium rounded-full',
      variantClasses[variant],
      className
    )}>
      {children || variant.toUpperCase()}
    </span>
  );
}