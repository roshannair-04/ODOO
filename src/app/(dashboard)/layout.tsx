import { requireEmployee } from "@/lib/auth";
import { navFor } from "@/components/site/nav-config";
import { Sidebar } from "@/components/site/sidebar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const employee = await requireEmployee();
  const items = navFor(employee.role);

  return (
    <div className="flex min-h-svh">
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header items={items} employee={employee} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
