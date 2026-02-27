import { prisma } from "@/lib/prisma";

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const startOfYesterday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export async function getDashboardData() {
  const todayStart = startOfToday();
  const yesterdayStart = startOfYesterday();

  const [
    jobsFoundToday,
    jobsFoundYesterday,
    applyTaskCounts,
    recentTasks,
    topLeads,
  ] = await Promise.all([
    prisma.jobLead.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.jobLead.count({
      where: {
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    prisma.applyTask.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.applyTask.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        jobLead: {
          select: {
            id: true,
            company: true,
            title: true,
            source: true,
          },
        },
      },
    }),
    prisma.jobLead.findMany({
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 5,
      where: { score: { not: null } },
      select: {
        id: true,
        title: true,
        company: true,
        score: true,
        location: true,
      },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    applyTaskCounts.map((g) => [g.status, g._count.id])
  );

  const submitted = (statusCounts.SUBMITTED ?? 0) + (statusCounts.NEEDS_OTP ?? 0) + (statusCounts.CONFIRMED ?? 0);
  const inReview = (statusCounts.SUBMITTED ?? 0) + (statusCounts.NEEDS_OTP ?? 0);
  const confirmed = statusCounts.CONFIRMED ?? 0;

  const trendLabel =
    jobsFoundYesterday > 0
      ? `+${jobsFoundToday - jobsFoundYesterday} vs yesterday`
      : undefined;

  const funnel = [
    { stage: "Applied", count: submitted },
    { stage: "Screening", count: statusCounts.NEEDS_OTP ?? 0 },
    { stage: "Interview", count: confirmed },
    { stage: "Offer", count: 0 },
  ];

  const maxFunnel = Math.max(funnel[0].count, 1);

  return {
    kpis: {
      jobsFoundToday,
      jobsFoundYesterday,
      trendLabel,
      trendUp: jobsFoundToday >= jobsFoundYesterday,
      autoApplied: submitted,
      inReview,
      confirmed,
    },
    recentApplications: recentTasks.map((t) => ({
      id: t.id,
      company: t.jobLead.company,
      role: t.jobLead.title,
      source: t.jobLead.source ?? "—",
      date: t.updatedAt.toISOString().slice(0, 10),
      status: t.status,
    })),
    topMatches: topLeads.map((l) => ({
      id: l.id,
      title: l.title,
      company: l.company,
      score: l.score ?? 0,
      location: l.location,
    })),
    funnel: funnel.map((f) => ({ ...f, widthPercent: (f.count / maxFunnel) * 100 })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
