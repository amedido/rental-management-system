import TenantSidebar from "@/app/tenant/components/TenantSidebar";

type TenantLayoutProps = {
  children: React.ReactNode;
};

export default function TenantLayout({
  children,
}: TenantLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <TenantSidebar />

      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
