import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageSquareText,
  StickyNote,
  CheckSquare,
  Calendar,
  BookHeart,
  BarChart3,
  Settings,
  Brain,
  FolderKanban,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import logo from "@/assets/misty-orb.png";

const main = [
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "AI Chat", url: "/app/chat", icon: MessageSquareText },
  { title: "Notes", url: "/app/notes", icon: StickyNote },
  { title: "Tasks", url: "/app/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/app/calendar", icon: Calendar },
  { title: "Journal", url: "/app/journal", icon: BookHeart },
];

const work = [
  { title: "Projects", url: "/app/projects", icon: FolderKanban },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
];

const personal = [
  { title: "Health", url: "/app/health", icon: HeartPulse },
  { title: "Memory Vault", url: "/app/memory", icon: Brain },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  const renderItems = (items: typeof main) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
          <Link to={item.url} className="flex items-center gap-3">
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src={logo}
            alt="Misty"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg group-hover:scale-105 transition-transform"
          />
          <span className="font-display text-lg font-semibold text-gradient">Misty</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(main)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(work)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(personal)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/app/settings")} tooltip="Settings">
              <Link to="/app/settings" className="flex items-center gap-3">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="glass-card mt-2 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--violet)]" />
            <span className="text-xs font-medium">Pro tip</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <kbd className="px-1 rounded bg-white/10">⌘K</kbd> for command palette ·{" "}
            <kbd className="px-1 rounded bg-white/10">⌘J</kbd> to summon Misty.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
