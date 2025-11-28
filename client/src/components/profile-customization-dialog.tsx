import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { SOCCER_TEAMS, COUNTRIES, TEAM_LOGOS } from "@/lib/teams";
import type { User } from "@shared/schema";

interface ProfileCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | undefined;
}

export function ProfileCustomizationDialog({ open, onOpenChange, user }: ProfileCustomizationDialogProps) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [nationality, setNationality] = useState(user?.nationality || "");
  const [favoriteTeam, setFavoriteTeam] = useState(user?.favoriteTeam || "");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPopoverOpen, setTeamPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canEditFirstName, setCanEditFirstName] = useState(true);
  const teamInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      checkFirstNameCooldown();
    }
  }, [open]);

  const checkFirstNameCooldown = async () => {
    try {
      const response = await fetch("/api/user/first-name-cooldown");
      const data = await response.json();
      setCanEditFirstName(data.canEdit);
    } catch (error) {
      console.error("Error checking first name cooldown:", error);
    }
  };

  const filteredTeams = SOCCER_TEAMS.filter((team) =>
    team.toLowerCase().includes(teamSearch.toLowerCase())
  );

  // Auto-focus the search input when popover opens
  useEffect(() => {
    if (teamPopoverOpen) {
      setTimeout(() => {
        teamInputRef.current?.focus();
        teamInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [teamPopoverOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (firstName !== user?.firstName && !canEditFirstName) {
        toast({
          title: "Error",
          description: "You can only change your display name once every 7 days",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (firstName !== user?.firstName) {
        await apiRequest("PATCH", "/api/user/first-name", { firstName });
      }

      await apiRequest("PATCH", "/api/user/profile", {
        nationality,
        favoriteTeam,
      });
      // Refetch all queries to ensure data is up-to-date
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/leagues"] });
      // Invalidate all leaderboard queries for any league
      await queryClient.invalidateQueries({ queryKey: ["/api/leagues", undefined, "leaderboard"] });
      toast({ title: "Success", description: "Profile updated successfully!" });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Customize Profile</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Select your favorite team as your profile picture
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-xs sm:text-sm">
              Display Name {!canEditFirstName && <span className="text-xs text-muted-foreground">(Next edit in 7 days)</span>}
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={!canEditFirstName}
              placeholder="Your display name"
              className="text-xs sm:text-sm"
              data-testid="input-first-name"
            />
            {!canEditFirstName && (
              <p className="text-xs text-muted-foreground">
                You can only change your display name once every 7 days
              </p>
            )}
          </div>

          {/* Team Logo Preview */}
          <div className="flex justify-center mb-6">
            {favoriteTeam && TEAM_LOGOS[favoriteTeam] ? (
              <img
                src={TEAM_LOGOS[favoriteTeam]}
                alt={favoriteTeam}
                className="w-24 h-24 rounded-full object-contain border-2 border-primary/20 p-2"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center bg-muted"
              style={{ display: (favoriteTeam && TEAM_LOGOS[favoriteTeam]) ? 'none' : 'flex' }}
            >
              <p className="text-xs text-muted-foreground text-center px-2">Select a team</p>
            </div>
          </div>

          {/* Nationality */}
          <div className="space-y-2">
            <Label htmlFor="nationality" className="text-xs sm:text-sm">
              Nationality
            </Label>
            <Select value={nationality} onValueChange={setNationality}>
              <SelectTrigger id="nationality" className="text-xs sm:text-sm" data-testid="select-nationality">
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country} className="text-xs sm:text-sm">
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Favorite Team with Unified Search */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">
              Favorite Soccer Team
            </Label>
            <Popover open={teamPopoverOpen} onOpenChange={setTeamPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left text-xs sm:text-sm font-normal"
                  data-testid="select-team"
                >
                  {favoriteTeam || "Search and select team..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0 max-h-[50vh] sm:max-h-80" side="top" align="start">
                <div className="p-2 border-b sticky top-0 bg-background z-10">
                  <Input
                    ref={teamInputRef}
                    placeholder="Search teams..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="text-xs sm:text-sm h-8"
                    data-testid="input-team-search"
                  />
                </div>
                <ScrollArea className="h-40 sm:h-64">
                  {filteredTeams.length > 0 ? (
                    <div className="space-y-1 p-2">
                      {filteredTeams.map((team) => (
                        <button
                          key={team}
                          onClick={() => {
                            setFavoriteTeam(team);
                            setTeamSearch("");
                            setTeamPopoverOpen(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-md text-xs sm:text-sm hover-elevate flex items-center gap-2"
                          data-testid={`team-option-${team}`}
                        >
                          {TEAM_LOGOS[team] ? (
                            <img
                              src={TEAM_LOGOS[team]}
                              alt={team}
                              className="w-5 h-5 object-contain flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-5 h-5 flex-shrink-0 bg-muted rounded" />
                          )}
                          <span className="truncate">{team}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      No teams found
                    </div>
                  )}
                </ScrollArea>
                {favoriteTeam && (
                  <div className="border-t p-2">
                    <button
                      onClick={() => {
                        setFavoriteTeam("");
                        setTeamSearch("");
                        teamInputRef.current?.focus();
                      }}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-md hover-elevate text-muted-foreground"
                      data-testid="button-clear-team"
                    >
                      <X className="h-3 w-3" />
                      Clear selection
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Save Button */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 text-xs sm:text-sm"
              data-testid="button-save-profile"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 text-xs sm:text-sm"
              data-testid="button-cancel-profile"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
