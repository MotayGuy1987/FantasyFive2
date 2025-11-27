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
import { SOCCER_TEAMS, COUNTRIES, AVATAR_COLORS } from "@/lib/teams";
import type { User } from "@shared/schema";

interface ProfileCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | undefined;
}

export function ProfileCustomizationDialog({ open, onOpenChange, user }: ProfileCustomizationDialogProps) {
  const { toast } = useToast();
  const [personColor, setPersonColor] = useState(user?.avatarPersonColor || "#3b82f6");
  const [bgColor, setBgColor] = useState(user?.avatarBgColor || "#dbeafe");
  const [nationality, setNationality] = useState(user?.nationality || "");
  const [favoriteTeam, setFavoriteTeam] = useState(user?.favoriteTeam || "");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPopoverOpen, setTeamPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const teamInputRef = useRef<HTMLInputElement>(null);

  const filteredTeams = SOCCER_TEAMS.filter((team) =>
    team.toLowerCase().includes(teamSearch.toLowerCase())
  );

  // Auto-focus the search input when popover opens
  useEffect(() => {
    if (teamPopoverOpen) {
      setTimeout(() => {
        teamInputRef.current?.focus();
      }, 0);
    }
  }, [teamPopoverOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiRequest("PATCH", "/api/user/profile", {
        avatarPersonColor: personColor,
        avatarBgColor: bgColor,
        nationality,
        favoriteTeam,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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
            Personalize your avatar and profile details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Avatar Preview */}
          <div className="flex justify-center mb-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{ backgroundColor: bgColor }}
            >
              <span style={{ color: personColor }}>
                {user?.firstName?.[0] || user?.email?.[0] || 'U'}
              </span>
            </div>
          </div>

          {/* Person Color */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Avatar Person Color</Label>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_COLORS.map((color) => {
                const isDisabled = bgColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => !isDisabled && setPersonColor(color)}
                    disabled={isDisabled}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      personColor === color ? 'border-gray-800 dark:border-gray-200 scale-110' : 'border-transparent'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{ backgroundColor: color }}
                    data-testid={`button-person-color-${color}`}
                    title={isDisabled ? "Already used for background" : ""}
                  />
                );
              })}
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Avatar Background Color</Label>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_COLORS.map((color) => {
                const isDisabled = personColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => !isDisabled && setBgColor(color)}
                    disabled={isDisabled}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      bgColor === color ? 'border-gray-800 dark:border-gray-200 scale-110' : 'border-transparent'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{ backgroundColor: color }}
                    data-testid={`button-bg-color-${color}`}
                    title={isDisabled ? "Already used for person color" : ""}
                  />
                );
              })}
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
                          className="w-full text-left px-2 py-1.5 rounded-md text-xs sm:text-sm hover-elevate"
                          data-testid={`team-option-${team}`}
                        >
                          {team}
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
