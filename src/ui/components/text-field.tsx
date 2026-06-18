import type { InputHTMLAttributes } from "react";
import { cn } from "@/ui/cn";

export const INPUT_CLASS =
  "min-h-12 rounded-md border border-grafite-600 bg-grafite-800 px-3 font-body text-sm text-aco-100 placeholder:text-aco-400";
export const LABEL_CLASS = "font-mono text-xs uppercase tracking-wide text-aco-400";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

/** Campo de texto rotulado, na linguagem visual do board. */
export function TextField({ label, name, className, ...props }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className={LABEL_CLASS}>
        {label}
      </label>
      <input id={name} name={name} className={cn(INPUT_CLASS, className)} {...props} />
    </div>
  );
}
