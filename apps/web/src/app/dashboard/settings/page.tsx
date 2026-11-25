import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { changePasswordAction, deleteAccountAction, revokeOtherSessionsAction, updateProfileAction } from "@/app/actions/account";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Badge, Card, Input, Label, Notice, buttonClass } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requireUser();
  const [org, members, sessions] = await read((db) => [db.orgs.find((o) => o.id === user.orgId), db.orgMembers.filter((m) => m.orgId === user.orgId), db.sessions.filter((s) => s.userId === user.id && Date.parse(s.expiresAt) > Date.now())]);
  return (
    <>
      <DashHeader title="Settings" />
      <div className="space-y-6">
        <Card className="p-5">
          <p className="font-semibold">Profile & workspace</p>
          <ActionForm action={updateProfileAction} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="n">Name</Label><Input id="n" name="name" defaultValue={user.name} required /></div>
              <div><Label htmlFor="e">Email</Label><Input id="e" value={user.email} disabled /></div>
              <div><Label htmlFor="o">Workspace name</Label><Input id="o" name="org" defaultValue={org?.name} required /></div>
              <div><Label>Role</Label><p className="flex h-10 items-center gap-2 text-[14px]"><Badge>{members.find((m) => m.userId === user.id)?.role ?? "member"}</Badge>{user.role === "admin" && <Badge tone="accent">platform admin</Badge>}</p></div>
            </div>
            <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" name="marketing" defaultChecked={user.marketingConsent} className="accent-[var(--accent)]" /> Receive product update emails</label>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <p className="font-semibold">Password</p>
          <ActionForm action={changePasswordAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" resetOnSuccess>
            <div><Label htmlFor="c">Current password</Label><Input id="c" name="current" type="password" autoComplete="current-password" required /></div>
            <div><Label htmlFor="nw">New password</Label><Input id="nw" name="next" type="password" autoComplete="new-password" required minLength={10} /></div>
            <SubmitButton>Change</SubmitButton>
          </ActionForm>
          <p className="mt-3 text-[12.5px] text-subtle">Multi-factor authentication becomes available when the Supabase Auth provider is enabled (TOTP); the development auth provider does not support it.</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Active sessions ({sessions.length})</p>
            {sessions.length > 1 && <form action={revokeOtherSessionsAction}><button className={buttonClass("outline", "sm")}>Sign out other sessions</button></form>}
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-muted">{sessions.map((s) => <li key={s.tokenHash}>{s.userAgent.slice(0, 90) || "Unknown device"} · since {fmtDateTime(s.createdAt)}</li>)}</ul>
        </Card>

        <Card className="p-5">
          <p className="font-semibold">Your data</p>
          <p className="mt-1 text-[13.5px] text-muted">Download a JSON export of your profile, orders, licences, runs, knowledge bases and tickets.</p>
          <a href="/api/account/export" className={buttonClass("outline", "sm", "mt-3")} download>Export my data</a>
        </Card>

        <Card className="border-danger/30 p-5">
          <p className="font-semibold text-danger">Delete account</p>
          <p className="mt-1 text-[13.5px] text-muted">Erases your profile, knowledge bases, keys and run outputs and signs you out. Order records are kept in anonymised form where the law requires bookkeeping retention. This cannot be undone.</p>
          <Notice tone="warning" className="mt-3">Products you own will no longer be accessible.</Notice>
          <ActionForm action={deleteAccountAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div><Label htmlFor="dc">Type DELETE</Label><Input id="dc" name="confirm" required autoComplete="off" /></div>
            <div><Label htmlFor="dp">Password</Label><Input id="dp" name="password" type="password" required /></div>
            <SubmitButton variant="danger">Delete my account</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
