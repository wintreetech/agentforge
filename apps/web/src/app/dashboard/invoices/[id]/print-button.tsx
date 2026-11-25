"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("outline", "sm")}>
      <Printer className="size-3.5" /> Print / save as PDF
    </button>
  );
}
