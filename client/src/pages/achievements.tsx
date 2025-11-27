import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, ArrowUp } from "lucide-react";
import { PositionBadge } from "@/components/position-badge";
import type { Player } from "@shared/schema";

interface Achievement {
  id: string;
  title: string;
  icon: string;
  count: number;
  topPlayers?: { player: Player; value: number }[];
  details?: AchievementDetail[];
}

interface AchievementDetail {
  player: Player;
  value: number;
}

export default function Achievements() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<AchievementDetail[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: achievements, isLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
    enabled: isAuthenticated,
  });

  const handleAchievementClick = (achievementId: string) => {
    setSelectedAchievement(achievementId);
    const achievement = achievements?.find((a) => a.id === achievementId);
    if (achievement) {
      const details = achievement.details || [];
      // Sort tied players alphabetically within their rank group
      const sortedDetails = [...details].sort((a, b) => {
        if (a.value === b.value) {
          return a.player.name.localeCompare(b.player.name);
        }
        return b.value - a.value;
      });
      setSelectedDetails(sortedDetails);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Award className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Achievements</h1>
          <p className="text-muted-foreground">Season Highlights & Records</p>
        </div>
      </div>

      {!achievements || achievements.length === 0 || achievements.every(a => (!a.topPlayers || a.topPlayers.length === 0)) ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No achievements yet. Players will appear here as they accumulate stats.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((achievement) => (
            <Card
              key={achievement.id}
              className="cursor-pointer hover-elevate transition-all"
              onClick={() => handleAchievementClick(achievement.id)}
              data-testid={`achievement-box-${achievement.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{achievement.title}</CardTitle>
                  <span className="text-2xl">{achievement.icon}</span>
                </div>
              </CardHeader>
              <CardContent>
                {achievement.topPlayers && achievement.topPlayers.length > 0 ? (
                  <div>
                    <p className="text-3xl font-bold text-primary">{achievement.topPlayers[0].value}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {achievement.topPlayers.length >= 3
                        ? "3+ People"
                        : achievement.topPlayers.length === 2
                          ? `${achievement.topPlayers[0].player.name} & ${achievement.topPlayers[1].player.name}`
                          : achievement.topPlayers[0].player.name}
                    </p>
                    <PositionBadge position={achievement.topPlayers[0].player.position} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data available</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {achievements?.find((a) => a.id === selectedAchievement)?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedDetails.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDetails.map((detail, index) => {
                    const uniqueValues = [...new Set(selectedDetails.map(d => d.value))].sort((a, b) => b - a);
                    const rank = uniqueValues.indexOf(detail.value) + 1;
                    return (
                      <TableRow key={`${detail.player.id}-${index}`}>
                        <TableCell className="font-semibold">
                          #{rank}
                        </TableCell>
                        <TableCell className="font-medium">{detail.player.name}</TableCell>
                        <TableCell>
                          <PositionBadge position={detail.player.position} />
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {detail.value}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No data available</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
