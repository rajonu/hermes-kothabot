import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-800 border border-gray-700">
        <span className="text-4xl">🤖</span>
      </div>

      <h1 className="text-6xl font-bold text-emerald-400 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-white mb-3">Page not found</h2>
      <p className="text-gray-400 max-w-sm mb-8">
        This page doesn&apos;t exist. It may have been moved, deleted, or you followed a broken link.
      </p>

      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors border border-gray-700"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
