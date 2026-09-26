import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control border text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-on-primary hover:bg-primary-hover hover:border-primary-hover",
        secondary: "border-border bg-surface text-text hover:bg-surface-muted",
        ghost: "border-transparent bg-transparent text-text-muted hover:bg-surface-muted hover:text-text",
        danger: "border-danger bg-danger text-on-primary hover:opacity-90",
      },
      size: {
        md: "h-9 px-3.5",
        sm: "h-8 px-2.5",
        icon: "size-9 text-text-muted hover:text-text",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
