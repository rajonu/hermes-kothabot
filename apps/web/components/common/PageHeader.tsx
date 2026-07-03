interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** @deprecated docs now live under the dedicated "Documentation" menu — no longer rendered here */
  docsUrl?: string;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-white">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs sm:text-sm text-gray-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
