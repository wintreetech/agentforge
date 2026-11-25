"use client";

import { useActionState } from "react";
import { createApiKeyAction } from "@/app/actions/account";
import { SubmitButton } from "@/components/forms";
import { Card, Input, Label, Notice } from "@/components/ui";

export function CreateKeyForm() {
  const [state, action] = useActionState(createApiKeyAction, undefined);
  return (
    <Card className="p-5">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="kname">Key name</Label>
          <Input id="kname" name="name" placeholder="e.g. Production server" required maxLength={60} />
        </div>
        <SubmitButton>Create key</SubmitButton>
      </form>
      {state?.error && <Notice tone="danger" className="mt-3">{state.error}</Notice>}
      {state?.secret && (
        <Notice tone="success" className="mt-3" title={state.ok}>
          <code className="mt-1 block select-all break-all rounded-lg bg-surface-2 p-2 font-mono text-[13px] text-fg">{state.secret}</code>
        </Notice>
      )}
    </Card>
  );
}
