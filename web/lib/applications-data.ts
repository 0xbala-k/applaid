import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function getApplications(page: number = 1) {
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    prisma.applyTask.findMany({
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        jobLead: {
          select: {
            id: true,
            company: true,
            title: true,
            source: true,
            url: true,
          },
        },
      },
    }),
    prisma.applyTask.count(),
  ]);

  return {
    items: items.map((t) => ({
      id: t.id,
      status: t.status,
      lastError: t.lastError,
      updatedAt: t.updatedAt.toISOString(),
      company: t.jobLead.company,
      role: t.jobLead.title,
      source: t.jobLead.source ?? "—",
      jobLeadId: t.jobLead.id,
      url: t.jobLead.url,
    })),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export type ApplicationsData = Awaited<ReturnType<typeof getApplications>>;
