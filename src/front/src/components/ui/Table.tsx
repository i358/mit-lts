import * as React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
interface TableHeadProps extends React.HTMLAttributes<HTMLTableHeaderCellElement> {}
interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {}

export function Table({ className, ...props }: TableProps) {
  return (
    <table className={`w-full ${className}`} {...props} />
  );
}

export function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead className={`bg-gray-800/50 ${className}`} {...props} />
  );
}

export function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody className={className} {...props} />
  );
}

export function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr className={className} {...props} />
  );
}

export function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th className={`px-4 py-3 text-left text-sm font-medium text-gray-400 ${className}`} {...props} />
  );
}

export function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td className={`px-4 py-3 text-sm ${className}`} {...props} />
  );
}