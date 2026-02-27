import { getDashboardData } from "@/lib/dashboard-data";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardContent data={data} />;
}
