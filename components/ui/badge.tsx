import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-slate-200 bg-slate-100 text-slate-700",
        green: "border-emerald-200 bg-emerald-50 text-emerald-800",
        blue: "border-sky-200 bg-sky-50 text-sky-800",
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        red: "border-red-200 bg-red-50 text-red-800",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge }
