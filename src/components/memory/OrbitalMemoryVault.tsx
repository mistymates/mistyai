import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import {
  ArrowRight,
  Brain,
  HeartPulse,
  Link,
  SlidersHorizontal,
  Target,
  User,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Memory, MemoryCategory, MemoryLink } from "@/lib/types/database";

type RelatedDomain = {
  id: MemoryCategory;
  strength: number;
  count: number;
  reasons: string[];
};

type MemoryOrbitItem = {
  id: MemoryCategory;
  title: MemoryCategory;
  date: string;
  content: string;
  icon: ElementType;
  relatedIds: MemoryCategory[];
  relatedDomains: RelatedDomain[];
  energy: number;
  count: number;
  memories: Memory[];
};

const CATEGORY_ICONS: Record<MemoryCategory, ElementType> = {
  Me: User,
  People: Users,
  Preferences: SlidersHorizontal,
  Goals: Target,
  Health: HeartPulse,
  Relationships: Link,
};

const CATEGORY_ORDER: MemoryCategory[] = [
  "Me",
  "People",
  "Preferences",
  "Goals",
  "Health",
  "Relationships",
];

function formatDate(value?: string) {
  if (!value) return "No entries";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildOrbitItems(memories: Memory[], links: MemoryLink[]): MemoryOrbitItem[] {
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]));
  const categoryLinks = new Map<MemoryCategory, Map<MemoryCategory, RelatedDomain>>();

  for (const link of links) {
    const source = memoryById.get(link.source_id);
    const target = memoryById.get(link.target_id);
    if (!source || !target || source.category === target.category) continue;

    const updateDomain = (from: MemoryCategory, to: MemoryCategory) => {
      const current = categoryLinks.get(from) ?? new Map<MemoryCategory, RelatedDomain>();
      const existing = current.get(to);
      if (existing) {
        existing.count += 1;
        existing.strength = Math.max(existing.strength, link.strength || 0);
        if (link.relationship_type && !existing.reasons.includes(link.relationship_type)) {
          existing.reasons.push(link.relationship_type);
        }
      } else {
        current.set(to, {
          id: to,
          count: 1,
          strength: link.strength || 0,
          reasons: link.relationship_type ? [link.relationship_type] : [],
        });
      }
      categoryLinks.set(from, current);
    };

    updateDomain(source.category, target.category);
    updateDomain(target.category, source.category);
  }

  return CATEGORY_ORDER.map((category) => {
    const categoryMemories = memories
      .filter((memory) => memory.category === category)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const averageImportance =
      categoryMemories.length === 0
        ? 2
        : categoryMemories.reduce((sum, memory) => sum + (memory.importance || 3), 0) /
          categoryMemories.length;

    const relatedDomains = Array.from(categoryLinks.get(category)?.values() ?? [])
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3);

    return {
      id: category,
      title: category,
      date: formatDate(categoryMemories[0]?.created_at),
      content: categoryMemories[0]?.content ?? `No ${category.toLowerCase()} memories saved yet.`,
      icon: CATEGORY_ICONS[category] ?? Brain,
      relatedIds: relatedDomains.map((domain) => domain.id),
      relatedDomains,
      energy: Math.min(100, Math.max(20, Math.round(averageImportance * 20))),
      count: categoryMemories.length,
      memories: categoryMemories,
    };
  });
}

interface OrbitalMemoryVaultProps {
  memories: Memory[];
  links: MemoryLink[];
  onDeleteMemory: (id: string) => void;
  onSelectCategory: (category: MemoryCategory) => void;
}

export function OrbitalMemoryVault({
  memories,
  links,
  onDeleteMemory,
  onSelectCategory,
}: OrbitalMemoryVaultProps) {
  const [expandedItems, setExpandedItems] = useState<Record<MemoryCategory, boolean>>(
    {} as Record<MemoryCategory, boolean>,
  );
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState<Record<MemoryCategory, boolean>>(
    {} as Record<MemoryCategory, boolean>,
  );
  const [activeNodeId, setActiveNodeId] = useState<MemoryCategory | null>(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1024 : window.innerWidth,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<MemoryCategory, HTMLDivElement | null>>(
    {} as Record<MemoryCategory, HTMLDivElement | null>,
  );

  const orbitItems = useMemo(() => buildOrbitItems(memories, links), [memories, links]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!autoRotate) return;

    const rotationTimer: ReturnType<typeof setInterval> = setInterval(() => {
      setRotationAngle((previous) => Number(((previous + 0.3) % 360).toFixed(3)));
    }, 50);

    return () => clearInterval(rotationTimer);
  }, [autoRotate]);

  const getRelatedItems = (itemId: MemoryCategory) =>
    orbitItems.find((item) => item.id === itemId)?.relatedIds ?? [];

  const isRelatedToActive = (itemId: MemoryCategory) =>
    activeNodeId ? getRelatedItems(activeNodeId).includes(itemId) : false;

  const centerViewOnNode = (nodeId: MemoryCategory) => {
    if (!nodeRefs.current[nodeId]) return;

    const nodeIndex = orbitItems.findIndex((item) => item.id === nodeId);
    const targetAngle = (nodeIndex / orbitItems.length) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const toggleItem = (id: MemoryCategory) => {
    setExpandedItems((previous) => {
      const isOpening = !previous[id];
      const nextState = CATEGORY_ORDER.reduce(
        (state, category) => ({ ...state, [category]: category === id && isOpening }),
        {} as Record<MemoryCategory, boolean>,
      );

      if (isOpening) {
        setActiveNodeId(id);
        setAutoRotate(false);
        setPulseEffect(
          getRelatedItems(id).reduce(
            (state, relId) => ({ ...state, [relId]: true }),
            {} as Record<MemoryCategory, boolean>,
          ),
        );
        onSelectCategory(id);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({} as Record<MemoryCategory, boolean>);
      }

      return nextState;
    });
  };

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === containerRef.current || event.target === orbitRef.current) {
      setExpandedItems({} as Record<MemoryCategory, boolean>);
      setActiveNodeId(null);
      setPulseEffect({} as Record<MemoryCategory, boolean>);
      setAutoRotate(true);
    }
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = Math.max(118, Math.min(210, viewportWidth * 0.26));
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.46, Math.min(1, 0.45 + 0.55 * ((1 + Math.sin(radian)) / 2)));

    return { x, y, zIndex, opacity };
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="relative min-h-[640px] overflow-hidden rounded-2xl border border-white/10 bg-black/35"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--cyan)_12%,transparent),transparent_52%)]" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Memory Map</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {memories.length} saved memories across {CATEGORY_ORDER.length} domains
          </p>
        </div>
        <Badge className="border-white/10 bg-white/5 text-foreground">
          {activeNodeId ?? "Orbiting"}
        </Badge>
      </div>

      <div className="relative h-[640px] w-full" ref={orbitRef} style={{ perspective: "1000px" }}>
        <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-[color:var(--violet)] via-[color:var(--cyan)] to-[color:var(--mint)] z-10">
          <div className="absolute h-20 w-20 animate-ping rounded-full border border-white/20 opacity-70" />
          <div className="absolute h-24 w-24 animate-ping rounded-full border border-white/10 opacity-50 [animation-delay:0.5s]" />
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/85 text-black backdrop-blur-md">
            <Brain className="h-4 w-4" />
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] max-w-[78vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-[18rem] w-[18rem] max-w-[56vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />

        {orbitItems.map((item, index) => {
          const position = calculateNodePosition(index, orbitItems.length);
          const isExpanded = expandedItems[item.id];
          const isRelated = isRelatedToActive(item.id);
          const isPulsing = pulseEffect[item.id];
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              ref={(element) => {
                nodeRefs.current[item.id] = element;
              }}
              className="absolute left-1/2 top-1/2 cursor-pointer transition-all duration-700"
              style={{
                transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                zIndex: isExpanded ? 200 : position.zIndex,
                opacity: isExpanded ? 1 : position.opacity,
              }}
              onClick={(event) => {
                event.stopPropagation();
                toggleItem(item.id);
              }}
            >
              <div
                className={`absolute rounded-full -inset-1 ${
                  isPulsing ? "animate-pulse duration-1000" : ""
                }`}
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)",
                  width: `${item.energy * 0.5 + 42}px`,
                  height: `${item.energy * 0.5 + 42}px`,
                  left: `-${(item.energy * 0.5 + 2) / 2}px`,
                  top: `-${(item.energy * 0.5 + 2) / 2}px`,
                }}
              />

              <div
                className={`grid h-11 w-11 place-items-center rounded-full border-2 transition-all duration-300 ${
                  isExpanded
                    ? "scale-150 border-white bg-white text-black shadow-lg shadow-white/30"
                    : isRelated
                      ? "animate-pulse border-white bg-white/50 text-black"
                      : "border-white/40 bg-black text-white"
                }`}
              >
                <Icon size={16} />
              </div>

              <div
                className={`absolute left-1/2 top-14 -translate-x-1/2 whitespace-nowrap text-xs font-semibold transition-all duration-300 ${
                  isExpanded ? "scale-125 text-white" : "text-white/70"
                }`}
              >
                {item.title}
                <span className="ml-1 text-white/40">{item.count}</span>
              </div>

              {isExpanded && (
                <Card className="absolute left-1/2 top-24 w-[min(22rem,82vw)] -translate-x-1/2 overflow-visible border-white/30 bg-black/90 shadow-xl shadow-white/10 backdrop-blur-lg">
                  <div className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-white/50" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="border-white bg-white text-black">
                        {item.count} {item.count === 1 ? "MEMORY" : "MEMORIES"}
                      </Badge>
                      <span className="text-xs font-mono text-white/50">{item.date}</span>
                    </div>
                    <CardTitle className="mt-2 text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-white/80">
                    <p className="line-clamp-3">{item.content}</p>

                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center">
                          <Zap size={10} className="mr-1" />
                          Signal strength
                        </span>
                        <span className="font-mono">{item.energy}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-[color:var(--cyan)] to-[color:var(--violet)]"
                          style={{ width: `${item.energy}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 max-h-44 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
                      {item.memories.length === 0 ? (
                        <p className="text-white/45">No entries in this domain yet.</p>
                      ) : (
                        item.memories.slice(0, 4).map((memory) => (
                          <div
                            key={memory.id}
                            className="group/item rounded-lg border border-white/10 bg-white/[0.03] p-2"
                          >
                            <div className="flex items-start gap-2">
                              <p className="min-w-0 flex-1 leading-relaxed">{memory.content}</p>
                              <button
                                aria-label="Delete memory"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteMemory(memory.id);
                                }}
                                className="text-white/35 opacity-0 transition hover:text-red-300 group-hover/item:opacity-100"
                              >
                                x
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="mb-2 flex items-center">
                        <Link size={10} className="mr-1 text-white/70" />
                        <h4 className="text-xs font-medium uppercase tracking-wider text-white/70">
                          Connected Domains
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.relatedDomains.length === 0 ? (
                          <p className="text-white/45">No semantic links for this domain yet.</p>
                        ) : (
                          item.relatedDomains.map((related) => (
                            <Button
                              key={related.id}
                              variant="outline"
                              size="sm"
                              className="h-6 rounded-none border-white/20 bg-transparent px-2 py-0 text-xs text-white/80 transition-all hover:bg-white/10 hover:text-white"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleItem(related.id);
                              }}
                            >
                              {related.id}
                              <span className="ml-1 text-[10px] text-white/55">
                                {related.count}x • {Math.round(related.strength * 100)}%
                              </span>
                              <ArrowRight size={8} className="ml-1 text-white/60" />
                            </Button>
                          ))
                        )}
                      </div>
                      {item.relatedDomains.length > 0 && (
                        <p className="mt-2 text-[10px] text-white/55">
                          Reasons:{" "}
                          {item.relatedDomains
                            .flatMap((domain) => domain.reasons)
                            .filter((reason, index, arr) => arr.indexOf(reason) === index)
                            .slice(0, 4)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
