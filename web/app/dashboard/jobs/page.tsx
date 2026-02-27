import { getJobs } from "@/lib/jobs-data";
import { JobsContent } from "./jobs-content";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const q = params.q ?? "";
  const data = await getJobs({ page: Number.isNaN(page) ? 1 : page, q: q || undefined });
  return <JobsContent data={data} searchQuery={q} />;
}
