interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      {description && (
        <p className="mt-2 text-gray-400">{description}</p>
      )}
    </div>
  );
}