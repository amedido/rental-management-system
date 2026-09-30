"use client";

import { usePathname, useRouter } from "next/navigation";

const navigation = [
  {
    label: "Dashboard",
    href: "/admin",
  },
  {
    label: "Tenants",
    href: "/admin/tenants",
  },
    {
    label: "Account management",
    href: "/admin/account-management",
  },
  {
    label: "Rent billing",
    href: "/admin/billing/rent",
  },
  {
    label: "Water billing",
    href: "/admin/billing/water",
  },
  {
    label: "Record payment",
    href: "/admin/payments",
  },
  {
    label: "Payment history",
    href: "/admin/payments/history",
  },
  {
    label: "Billing settings",
    href: "/admin/settings/billing",
  },
];

export default function AdminSidebar( ) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.replace("/login");
  }

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          Mashaallah
        </p>

        <h1 className="mt-2 text-xl font-bold">
          Rental Management
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Administrator panel
        </p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        {navigation.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : item.href === "/admin/payments"
              ? pathname === "/admin/payments"
              : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                isActive
                  ? "bg-blue-700 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
