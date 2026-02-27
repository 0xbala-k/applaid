import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export type JobsFilters = {
  page?: number;
  q?: string;
};

export async function getJobs(filters: JobsFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const query = (filters.q ?? "").trim();
  const skip = (page - 1) * PAGE_SIZE;

  const where = query
    ? {
        OR: [
          { company: { contains: query, mode: "insensitive" as const } },
          { title: { contains: query, mode: "insensitive" as const } },
          { location: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [items, total] = await Promise.all([
    prisma.jobLead.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        url: true,
        source: true,
        score: true,
        createdAt: true,
      },
    }),
    prisma.jobLead.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export type JobsData = Awaited<ReturnType<typeof getJobs>>;
