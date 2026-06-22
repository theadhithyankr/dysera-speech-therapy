import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#1E3A5F] text-white",
        secondary: "border-transparent bg-[#2A9D8F] text-white",
        outline: "border-[#cbd5e1] text-[#334155]",
        mild: "border-transparent bg-emerald-100 text-emerald-700",
        moderate: "border-transparent bg-amber-100 text-amber-700",
        severe: "border-transparent bg-red-100 text-red-700",
        destructive: "border-transparent bg-red-100 text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
