
export default function LessonsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-white">
      <main>{children}</main>
    </div>
  );
}
