import type { ReactNode } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { EyeOff, GripVertical } from "lucide-react";
import type { WidgetMeta } from "@/components/dashboard/dashboard-layout";

type DashboardWidgetProps = {
  widget: WidgetMeta;
  index: number;
  editing: boolean;
  onHide: () => void;
  children: ReactNode;
};

export function DashboardWidget({
  widget,
  index,
  editing,
  onHide,
  children,
}: DashboardWidgetProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={widget.id}
      as="div"
      drag={editing ? "y" : false}
      dragListener={false}
      dragControls={dragControls}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: editing ? 0 : index * 0.02, duration: editing ? 0.18 : 0.28 }}
      whileDrag={{ scale: 1.015, zIndex: 30 }}
      className={`${widget.span} relative min-w-0`}
    >
      {editing && (
        <div className="absolute -top-2 -right-2 z-10 flex gap-1">
          <button
            type="button"
            onClick={onHide}
            className="grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-background/80 backdrop-blur-xl transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Hide ${widget.label} widget`}
          >
            <EyeOff className="h-3 w-3" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => dragControls.start(event)}
            className="grid h-7 w-7 touch-none place-items-center rounded-full border border-white/15 bg-background/80 backdrop-blur-xl transition cursor-grab hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Drag ${widget.label} widget`}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
      {children}
    </Reorder.Item>
  );
}
