import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-surface-container-lowest">
      <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#5B13EC] flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[36px]">error</span>
      </div>
      <h1 className="text-2xl font-bold text-on-surface mb-2">Page Not Found</h1>
      <p className="text-sm text-secondary max-w-sm mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-sm font-bold shadow-sm transition-all"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

