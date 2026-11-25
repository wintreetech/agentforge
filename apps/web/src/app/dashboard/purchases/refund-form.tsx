"use client";

import { useActionState, useState } from "react";
import { requestRefundAction } from "@/app/actions/account";
import { SubmitButton } from "@/components/forms";
import { Textarea } from "@/components/ui";

export function RefundForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(requestRefundAction, undefined);
  if (state?.ok) return <p className="text-success">{state.ok}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-muted underline underline-offset-2 hover:text-fg">Request a refund</button>;
  return (
    <form action={action} className="w-full space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor={`r-${orderId}`} className="text-[13px] font-medium">Why are you requesting a refund?</label>
      <Textarea id={`r-${orderId}`} name="reason" rows={3} required minLength={10} maxLength={2000} />
      {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
      <div className="flex gap-2"><SubmitButton size="sm">Submit request</SubmitButton><button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted">Cancel</button></div>
    </form>
  );
}
