export default async function FriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Remove server-side auth check to prevent redirect loops
  // Let client-side AuthProvider handle authentication
  return <>{children}</>;
}
