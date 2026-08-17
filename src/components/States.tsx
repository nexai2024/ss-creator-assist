import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return <Loader2 className="animate-spin text-primary-500" style={{ width: size, height: size }} />;
}

export function FullPageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={32} />
        <p className="text-sm text-neutral-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-neutral-700 mb-1">{title}</h3>
      <p className="text-sm text-neutral-400 max-w-sm">{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-danger-50 flex items-center justify-center text-danger-500 mb-4">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-neutral-700 mb-1">Something went wrong</h3>
      <p className="text-sm text-neutral-400 max-w-sm">{message}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-neutral-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-neutral-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-neutral-100 rounded w-2/3" />
              <div className="h-2.5 bg-neutral-50 rounded w-1/3" />
            </div>
            <div className="h-5 w-16 bg-neutral-100 rounded-full flex-shrink-0" />
            <div className="h-5 w-16 bg-neutral-100 rounded-full flex-shrink-0 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-neutral-100" />
            <div className="h-5 w-16 bg-neutral-100 rounded-full" />
          </div>
          <div className="h-4 bg-neutral-100 rounded w-3/4 mb-2" />
          <div className="h-3 bg-neutral-50 rounded w-1/2 mb-4" />
          <div className="flex gap-2 mb-4">
            <div className="h-6 w-20 bg-neutral-50 rounded-md" />
            <div className="h-6 w-20 bg-neutral-50 rounded-md" />
          </div>
          <div className="pt-3 border-t border-neutral-50">
            <div className="h-3 bg-neutral-50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
