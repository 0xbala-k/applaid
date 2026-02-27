import { getApplications } from "@/lib/applications-data";
import { ApplicationsContent } from "./applications-content";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function ApplicationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const data = await getApplications(Number.isNaN(page) ? 1 : page);
  return <ApplicationsContent data={data} />;
}
