import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account and notification settings.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <p className="text-sm text-muted-foreground">
            Settings will be available here.
          </p>
        </CardHeader>
      </Card>
    </div>
  );
}
