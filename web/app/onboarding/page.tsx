"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  X,
  Check,
  AlertCircle,
  Mail,
  Bell,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Resume", icon: Upload },
  { id: 2, label: "Preferences", icon: FileText },
  { id: 3, label: "Automations", icon: Zap },
];

type OnboardingPayload = {
  email: string;
  targetRole: string;
  location: string;
  salaryMin: string;
  jobTypes: string[];
  remotePreference: string;
  keywordsInclude: string;
  keywordsExclude: string;
  searchFrequency: string;
  autoApply: boolean;
  gmailOtp: boolean;
  notifications: boolean;
};

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const REMOTE_OPTIONS = ["Remote only", "Hybrid", "On-site", "Any"];
const FREQUENCY_OPTIONS = ["Hourly", "Daily", "Weekly"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<OnboardingPayload>({
    email: "",
    targetRole: "",
    location: "Bay Area / Remote",
    salaryMin: "",
    jobTypes: ["Full-time"],
    remotePreference: "Remote only",
    keywordsInclude: "",
    keywordsExclude: "",
    searchFrequency: "Daily",
    autoApply: false,
    gmailOtp: false,
    notifications: true,
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.type === "application/pdf" || f.name.endsWith(".docx"))) {
      setFile(f);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const toggleJobType = (type: string) => {
    setForm((prev) => ({
      ...prev,
      jobTypes: prev.jobTypes.includes(type)
        ? prev.jobTypes.filter((t) => t !== type)
        : [...prev.jobTypes, type],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const email = form.email.trim();
    if (!email) {
      setSubmitError("Please enter your email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    if (!form.targetRole.trim()) {
      setSubmitError("Please enter a target role or title.");
      return;
    }
    setSaving(true);
    try {
      const keywords = [form.keywordsInclude.trim(), form.keywordsExclude.trim()]
        .filter(Boolean)
        .join(" | ");
      const prefRes = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          title: form.targetRole.trim() || undefined,
          location: form.location.trim() || undefined,
          minSalary: form.salaryMin ? parseInt(form.salaryMin, 10) : undefined,
          keywords: keywords || undefined,
          autoApply: form.autoApply,
        }),
      });
      const prefJson = await prefRes.json();
      if (!prefRes.ok) {
        throw new Error(prefJson.error?.message ?? prefJson.error ?? "Failed to save preferences.");
      }
      if (file) {
        const uploadForm = new FormData();
        uploadForm.set("file", file);
        uploadForm.set("email", email);
        const uploadRes = await fetch("/api/resume/upload", {
          method: "POST",
          body: uploadForm,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadJson.error?.message ?? uploadJson.error ?? "Failed to upload resume.");
        }
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">All set</h2>
        <p className="text-sm text-muted-foreground">
          Redirecting you to the dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Get started</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your resume, set preferences, and choose automations.
        </p>
      </header>

      <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
        <TabsList className="grid w-full grid-cols-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <TabsTrigger key={s.id} value={String(s.id)} className="gap-2">
                <Icon className="h-4 w-4" />
                {s.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="1" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload resume</CardTitle>
              <CardDescription>
                We use this to tailor matches and auto-fill applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 py-10 px-6 text-center transition-colors",
                  dragActive && "border-primary bg-muted/50"
                )}
              >
                <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Drag and drop your resume here, or browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF or DOCX
                </p>
                <Label htmlFor="resume-upload" className="mt-4 cursor-pointer">
                  <span className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                    Browse
                  </span>
                  <input
                    id="resume-upload"
                    type="file"
                    accept=".pdf,.docx"
                    className="sr-only"
                    onChange={handleFileSelect}
                  />
                </Label>
              </div>
              {file && (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span className="text-sm truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="2" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferences</CardTitle>
              <CardDescription>
                Tell us what you’re looking for so we can surface the right roles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Contact email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Used to link your resume and preferences; the worker uses this for discovery and apply.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetRole">Target role / title</Label>
                <Input
                  id="targetRole"
                  placeholder="e.g. Software Engineer – Stablecoins"
                  value={form.targetRole}
                  onChange={(e) => setForm((p) => ({ ...p, targetRole: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Bay Area / Remote"
                    value={form.location}
                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Salary minimum (USD)</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    min={0}
                    placeholder="150000"
                    value={form.salaryMin}
                    onChange={(e) => setForm((p) => ({ ...p, salaryMin: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Job type</Label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={form.jobTypes.includes(type) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleJobType(type)}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote">Remote preference</Label>
                <Select
                  value={form.remotePreference}
                  onValueChange={(v) => setForm((p) => ({ ...p, remotePreference: v }))}
                >
                  <SelectTrigger id="remote">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMOTE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywordsInclude">Keywords to include</Label>
                <Input
                  id="keywordsInclude"
                  placeholder="e.g. React, TypeScript, Web3"
                  value={form.keywordsInclude}
                  onChange={(e) => setForm((p) => ({ ...p, keywordsInclude: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywordsExclude">Keywords to exclude</Label>
                <Input
                  id="keywordsExclude"
                  placeholder="e.g. Senior only, PHP"
                  value={form.keywordsExclude}
                  onChange={(e) => setForm((p) => ({ ...p, keywordsExclude: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Search frequency</Label>
                <Select
                  value={form.searchFrequency}
                  onValueChange={(v) => setForm((p) => ({ ...p, searchFrequency: v }))}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="3" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automations & confirm</CardTitle>
              <CardDescription>
                Choose what Applaid can do on your behalf.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable auto-apply</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically submit applications for matching jobs.
                  </p>
                </div>
                <Switch
                  checked={form.autoApply}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, autoApply: v }))}
                />
              </div>
              {form.autoApply && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-amber-800 dark:text-amber-200">
                    Auto-apply will use your resume and preferences to submit on job boards. Review your preferences before enabling.
                  </p>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Enable Gmail OTP parsing</p>
                    <p className="text-xs text-muted-foreground">
                      Read verification codes from your inbox when required.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.gmailOtp}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, gmailOtp: v }))}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Enable notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when you get a match or status update.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.notifications}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, notifications: v }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What happens next</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                <li>We’ll start discovering jobs based on your preferences.</li>
                <li>You can review matches on the dashboard and adjust settings anytime.</li>
                <li>If auto-apply is on, we’ll submit applications for high-confidence matches.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 3 && (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          )}
        </div>
        {step === 3 && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save & Start Tracking"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/dashboard")}
            >
              Skip for now
            </Button>
          </form>
        )}
      </div>

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}
    </div>
  );
}
