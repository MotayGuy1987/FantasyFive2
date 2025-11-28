import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@/lib/teams";
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
  const [loading, setLoading] = useState(false);
  const [canEditFirstName, setCanEditFirstName] = useState(true);

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
            Update your profile information
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
