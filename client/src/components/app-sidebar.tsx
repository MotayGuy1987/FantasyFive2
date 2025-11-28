import { Home, Users, Repeat, Trophy, ShieldCheck, BarChart3, Settings, Moon, Sun, Info, HelpCircle, LogOut, Copy, Check } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
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
import { useTheme } from "@/hooks/useTheme.tsx";
import { ProfileCustomizationDialog } from "@/components/profile-customization-dialog";
import { COUNTRY_FLAGS, TEAM_LOGOS } from "@/lib/teams";
import type { User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const baseMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Transfers",
    url: "/transfers",
    icon: Repeat,
  },
  {
    title: "Leagues",
    url: "/leagues",
    icon: Trophy,
  },
  {
    title: "Achievements",
    url: "/achievements",
    icon: BarChart3,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"theme" | "account" | "help" | "about">("theme");
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const userData = user as User | undefined;
  
  const isAdmin = userData?.email === "admin@admin.com";
  const hasTeam = !!userData?.teamName;
  
  const handleCopyUsername = () => {
    if (userData?.username) {
      navigator.clipboard.writeText(userData.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const teamMenuItem = {
    title: hasTeam ? "My Team" : "Build First Team",
    url: hasTeam ? "/my-team" : "/build-first-team",
    icon: Users,
  };
  
  const menuItems = [
    baseMenuItems[0],
    teamMenuItem,
    baseMenuItems[1],
    baseMenuItems[2],
    baseMenuItems[3],
    baseMenuItems[4],
  ];
  
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
      <SidebarFooter className="p-4 space-y-2">
        {userData && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-3 flex-1 rounded-md p-2 hover-elevate border border-muted-foreground/30 cursor-pointer"
              data-testid="button-profile-customize"
            >
              {userData.favoriteTeam && TEAM_LOGOS[userData.favoriteTeam] ? (
                <img
                  src={TEAM_LOGOS[userData.favoriteTeam]}
                  alt={userData.favoriteTeam}
                  className="h-8 w-8 rounded-full object-contain flex-shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <Avatar className="h-8 w-8 flex-shrink-0" style={{ display: (userData.favoriteTeam && TEAM_LOGOS[userData.favoriteTeam]) ? 'none' : 'flex' }}>
                <AvatarFallback>
                  <span>{userData.firstName?.[0] || userData.email?.[0] || 'U'}</span>
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {userData.firstName || userData.email || 'User'}
                  </p>
                  {userData.nationality && COUNTRY_FLAGS[userData.nationality] && (
                    <span className="text-base flex-shrink-0">
                      {COUNTRY_FLAGS[userData.nationality]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {userData.teamName || 'No team yet'}
                </p>
              </div>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              data-testid="button-settings"
              className="h-8 w-8 flex-shrink-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          Log Out
        </Button>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="w-[95vw] sm:max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader className="py-2">
              <DialogTitle className="text-lg sm:text-xl">Settings</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Manage your preferences and account
              </DialogDescription>
            </DialogHeader>
            
            {/* Tab Navigation */}
            <div className="flex gap-1 sm:gap-2 border-b overflow-x-auto -mx-6 px-6">
              <Button
                variant={activeTab === "theme" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("theme")}
                className="flex-1 min-w-max text-xs sm:text-sm"
              >
                <Moon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Theme</span>
              </Button>
              <Button
                variant={activeTab === "account" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("account")}
                className="flex-1 min-w-max text-xs sm:text-sm"
              >
                <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Account</span>
              </Button>
              <Button
                variant={activeTab === "help" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("help")}
                className="flex-1 min-w-max text-xs sm:text-sm"
              >
                <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Help</span>
              </Button>
              <Button
                variant={activeTab === "about" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("about")}
                className="flex-1 min-w-max text-xs sm:text-sm"
              >
                <Info className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">About</span>
              </Button>
            </div>

            {/* Theme Tab */}
            {activeTab === "theme" && (
              <div className="space-y-3 sm:space-y-4 py-2">
                <div className="flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-md border">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {theme === "light" ? (
                      <Sun className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    ) : (
                      <Moon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium">Theme</p>
                      <p className="text-xs text-muted-foreground">
                        {theme === "light" ? "Light Mode" : "Dark Mode"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleTheme}
                    data-testid="button-toggle-theme"
                    className="text-xs sm:text-sm flex-shrink-0"
                  >
                    {theme === "light" ? "Dark" : "Light"}
                  </Button>
                </div>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === "account" && (
              <div className="space-y-3 sm:space-y-4 py-2">
                <div className="space-y-2 sm:space-y-3 p-2 sm:p-3 rounded-md border bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <div className="flex items-center gap-2 mt-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate">{userData?.username || 'N/A'}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0"
                        onClick={handleCopyUsername}
                        data-testid="button-copy-username"
                      >
                        {copied ? (
                          <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Team Name</p>
                    <p className="text-xs sm:text-sm font-medium mt-1 break-words">{userData?.teamName || 'No team yet'}</p>
                  </div>
                  {userData?.firstName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Display Name</p>
                      <p className="text-xs sm:text-sm font-medium mt-1 break-words">
                        {userData.firstName} {userData.lastName || ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Help Tab */}
            {activeTab === "help" && (
              <div className="space-y-2 sm:space-y-3 py-2">
                <div>
                  <p className="text-xs sm:text-sm font-medium mb-0.5">Squad Building</p>
                  <p className="text-xs text-muted-foreground">Build a 5-a-side team with 1 bench player. Min budget is £50M.</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium mb-0.5">Transfers</p>
                  <p className="text-xs text-muted-foreground">Get 1 free transfer per gameweek. Additional transfers cost 2 points.</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium mb-0.5">Chips</p>
                  <p className="text-xs text-muted-foreground">Triple Captain (3x points) and Bench Boost (6 active players) available once per season.</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium mb-0.5">Leagues</p>
                  <p className="text-xs text-muted-foreground">Create or join leagues to compete with friends.</p>
                </div>
              </div>
            )}

            {/* About Tab */}
            {activeTab === "about" && (
              <div className="space-y-2 sm:space-y-3 py-2">
                <div>
                  <p className="text-xs sm:text-sm font-medium">Fantasy Mini League</p>
                  <p className="text-xs text-muted-foreground mt-1">v1.0.0</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A 5-a-side fantasy football mini-game inspired by Fantasy Premier League. Build your squad, manage transfers, and compete in leagues.</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Made with React, TypeScript, and Drizzle ORM.</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ProfileCustomizationDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          user={userData}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
