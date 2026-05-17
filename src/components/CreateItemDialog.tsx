import type { FormEvent, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CreateItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  submitDisabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  contentClassName?: string;
};

export function CreateItemDialog({
  open,
  onOpenChange,
  trigger,
  title,
  submitLabel,
  submittingLabel,
  isSubmitting,
  submitDisabled,
  onSubmit,
  children,
  contentClassName = "sm:max-w-[425px]",
}: CreateItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={`${contentClassName} bg-black/90 border-white/10 backdrop-blur-xl`}>
        <DialogHeader>
          <DialogTitle className="text-xl font-display">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-4">
          {children}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || submitDisabled}
              className="bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium"
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
