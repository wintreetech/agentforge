"use client";

import { Copy, Download } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function ExportButtons({ name, markdown }: { name: string; markdown: string }) {
  return (
    <>
      <button type="button" className={buttonClass("outline", "sm")} onClick={() => navigator.clipboard.writeText(markdown)}><Copy className="size-3.5" /> Copy</button>
      <button
        type="button"
        className={buttonClass("outline", "sm")}
        onClick={() => {
          const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}.md`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        <Download className="size-3.5" /> Export
      </button>
    </>
  );
}
