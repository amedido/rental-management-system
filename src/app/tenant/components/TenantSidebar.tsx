"use client";

import { usePathname, useRouter } from "next/navigation";

const navigation = [
  {
    label: "Tenant dashboard",
    href: "/tenant",
  },
  {
    label: "Balance summary",
    href: "/tenant#balances",
  },
  {
    label: "Rent bill history",
    href: "/tenant#rent-bills",
  },
  {
    label: "Water bill history",
    href: "/tenant#water-bills",
  },
  {
    label: "Payments and receipts",
    href: "/tenant#payments",
  },
];

function getPathname(href: string) {
  return href.split("#")[0];
}

export default function TenantSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.replace("/login");
  }

  function navigate(href: string) {
    const [path, hash] = href.split("#");

    router.push(path);

    if (hash) {
      window.setTimeout(() => {
        document
          .getElementById(hash)
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col bg-slate-950 text-white print:hidden">
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          Mashaallah
        </p>

        <h1 className="mt-2 text-xl font-bold">
          Tenant Portal
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Resident account
        </p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        {navigation.map((item) => {
          const itemPathname = getPathname(item.href);
          const isActive =
            itemPathname === "/tenant" &&
            pathname === "/tenant";

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
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
