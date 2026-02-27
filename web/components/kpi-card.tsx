import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type KpiCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { label: string; up?: boolean };
  className?: string;
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("transition-shadow duration-150 hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {icon && (
          <span className="text-muted-foreground/80" aria-hidden>
            {icon}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {(subtitle || trend) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  "font-medium",
                  trend.up === true && "text-emerald-600 dark:text-emerald-400",
                  trend.up === false && "text-rose-600 dark:text-rose-400"
                )}
              >
                {trend.label}
              </span>
            )}
            {trend && subtitle && " · "}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
