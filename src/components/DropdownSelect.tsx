import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DropdownSelectOption = {
  value: string;
  label: string;
};

type DropdownSelectProps = {
  value: string;
  options: DropdownSelectOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
};

export function DropdownSelect({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  className,
  contentClassName,
}: DropdownSelectProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "h-10 w-full justify-between rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-normal text-foreground shadow-none hover:bg-white/10",
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("w-[--radix-dropdown-menu-trigger-width]", contentClassName)}
      >
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            <span className="flex-1">{option.label}</span>
            {option.value === value && <Check className="h-4 w-4 text-[color:var(--cyan)]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
