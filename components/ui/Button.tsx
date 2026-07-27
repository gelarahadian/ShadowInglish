export default function Button({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 ${className}`}
    >
      {children}
    </button>
  );
}
