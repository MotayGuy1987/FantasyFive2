import { Home, Users, Repeat, Trophy, ShieldCheck, BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "My Team",
    url: "/my-team",
    icon: Users,
  },
  {
    title: "Leagues",
    url: "/leagues",
    icon: Trophy,
  },
  {
    title: "Stats",
    url: "/stats",
    icon: BarChart3,
  },
];

const adminMenuItem = {
  title: "Admin Panel",
  url: "/admin",
  icon: ShieldCheck,
};

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const userData = user as User | undefined;
  
  const isAdmin = userData?.email === "admin@admin.com";
  
  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.clear();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Fantasy League</h1>
            <p className="text-xs text-muted-foreground">Mini 5-a-side</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === adminMenuItem.url} data-testid="link-admin">
                    <Link href={adminMenuItem.url}>
                      <adminMenuItem.icon className="h-4 w-4" />
                      <span>{adminMenuItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {userData && (
          <div className="flex items-center gap-3 rounded-md p-2 hover-elevate">
            <Avatar className="h-8 w-8">
              <AvatarImage src={userData.profileImageUrl || undefined} />
              <AvatarFallback>
                {userData.firstName?.[0] || userData.email?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {userData.firstName || userData.email || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userData.teamName || 'No team yet'}
              </p>
            </div>
          </div>
        )}
        <Button 
          variant="outline" 
          className="w-full mt-2"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          Log Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
