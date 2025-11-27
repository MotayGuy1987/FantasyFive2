import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Trophy, TrendingUp, Users, Star, Zap, TrendingDown } from "lucide-react";
import type { Team, Gameweek, Player, TeamPlayer, Chip } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: team, isLoading: teamLoading } = useQuery<Team>({
    queryKey: ["/api/team"],
    enabled: isAuthenticated,
    staleTime: 10000, // Data is fresh for 10 seconds
    refetchInterval: 15000, // Refetch total points every 15 seconds
    refetchIntervalInBackground: true,
  });

  const { data: currentGameweek, isLoading: gameweekLoading } = useQuery<Gameweek>({
    queryKey: ["/api/gameweeks/current"],
    enabled: isAuthenticated,
  });

  const { data: teamPlayers } = useQuery<(TeamPlayer & { player: Player })[]>({
    queryKey: ["/api/team/players"],
    enabled: isAuthenticated && !!team,
  });

  const { data: gameweekScore } = useQuery<{ points: number }>({
    queryKey: ["/api/team/gameweek-score", currentGameweek?.id],
    enabled: isAuthenticated && !!currentGameweek,
    staleTime: 5000, // Data is fresh for 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchIntervalInBackground: true, // Keep refetching even when tab is not focused
  });

  const { data: chipsUsed } = useQuery<Chip[]>({
    queryKey: ["/api/chips"],
    enabled: isAuthenticated && !!team,
  });

  const { data: allGameweeks } = useQuery<Gameweek[]>({
    queryKey: ["/api/gameweeks"],
    enabled: isAuthenticated,
  });

  const { data: playerOfWeek } = useQuery<{ player: Player | null; points: number; gameweekNumber?: number; message?: string }>({
    queryKey: ["/api/dashboard/player-of-week"],
    enabled: isAuthenticated,
  });

  const { data: teamOfWeek } = useQuery<{ team: Team | null; user: { firstName: string; email: string } | null; points: number; message?: string }>({
    queryKey: ["/api/dashboard/team-of-week"],
    enabled: isAuthenticated,
  });

  const { data: mostOwnedPlayer } = useQuery<{ players: Player[]; count: number; percentage: number; message?: string }>({
    queryKey: ["/api/dashboard/most-owned-player"],
    enabled: isAuthenticated,
  });

  const activateChipMutation = useMutation({
    mutationFn: async (chipType: "BENCH_BOOST" | "TRIPLE_CAPTAIN") => {
      if (!currentGameweek) throw new Error("No active gameweek");
      await apiRequest("POST", "/api/chips/activate", {
        chipType,
        gameweekId: currentGameweek.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chips"] });
      toast({
        title: "Success",
        description: "Chip activated for this gameweek!",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getChipStatus = (chipType: "BENCH_BOOST" | "TRIPLE_CAPTAIN") => {
    if (!chipsUsed || !currentGameweek || !allGameweeks) return { canUse: true, nextAvailableGW: null };
    
    const chipHistory = chipsUsed.filter((c: Chip) => c.chipType === chipType);
    if (chipHistory.length === 0) return { canUse: true, nextAvailableGW: null };

    const usedThisGameweek = chipHistory.some((c: Chip) => c.gameweekId === currentGameweek.id);
    if (usedThisGameweek) return { canUse: false, nextAvailableGW: null, usedThisWeek: true };
    
    const chipsWithGameweeks = chipHistory.map((c: Chip) => {
      const gw = allGameweeks.find((g: Gameweek) => g.id === c.gameweekId);
      return { ...c, gameweekNumber: gw?.number || 0 };
    }).sort((a, b) => b.gameweekNumber - a.gameweekNumber);

    if (chipsWithGameweeks.length > 0) {
      const lastUsed = chipsWithGameweeks[0];
      const gameweeksSinceLastUse = currentGameweek.number - lastUsed.gameweekNumber;
      
      if (gameweeksSinceLastUse < 7) {
        const nextAvailableGW = lastUsed.gameweekNumber + 7;
        return { canUse: false, nextAvailableGW, usedThisWeek: false };
      }
    }
    
    return { canUse: true, nextAvailableGW: null };
  };

  const benchBoostStatus = getChipStatus("BENCH_BOOST");
  const tripleCaptainStatus = getChipStatus("TRIPLE_CAPTAIN");

  if (isLoading || teamLoading || gameweekLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const hasTeam = !!team && teamPlayers && teamPlayers.length > 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Dashboard</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {currentGameweek 
            ? `Gameweek ${currentGameweek.number}${currentGameweek.isActive ? ' (Active)' : currentGameweek.isCompleted ? ' (Completed)' : ''}`
            : 'Season not started'}
        </p>
      </div>

      {!hasTeam ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-3 sm:mb-4">
              <Users className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <h2 className="text-lg sm:text-2xl font-bold mb-2">Build Your Squad</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
              You haven't created a team yet. Pick your 5 starters and 1 bench player to get started!
            </p>
            <Button size="lg" asChild data-testid="button-build-squad">
              <Link href="/my-team">Build Squad</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Total Points</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">{team.totalPoints || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">All gameweeks</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gameweek Points</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">
                  {gameweekScore?.points || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentGameweek ? `GW ${currentGameweek.number}` : 'No active gameweek'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Free Transfers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">{team.freeTransfers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Available now</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Player of the Week</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {playerOfWeek?.message === "N/A" || !playerOfWeek?.player ? (
                  <p className="text-sm text-muted-foreground">N/A</p>
                ) : (
                  <>
                    <p className="text-lg font-bold">{playerOfWeek.player.name}</p>
                    <p className="text-xs text-muted-foreground">{playerOfWeek.points} points</p>
                    {playerOfWeek.gameweekNumber && (
                      <p className="text-xs text-muted-foreground mt-1">GW {playerOfWeek.gameweekNumber}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team of the Week</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {teamOfWeek?.message === "N/A" || !teamOfWeek?.team ? (
                  <p className="text-sm text-muted-foreground">N/A</p>
                ) : (
                  <>
                    <p className="text-lg font-bold">{teamOfWeek.user?.firstName || "Team"}</p>
                    <p className="text-xs text-muted-foreground">{teamOfWeek.user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">{teamOfWeek.points} points</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Owned</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {mostOwnedPlayer?.message === "N/A" || !mostOwnedPlayer?.players || mostOwnedPlayer.players.length === 0 ? (
                  <p className="text-sm text-muted-foreground">N/A</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      {mostOwnedPlayer.players.map((player) => (
                        <p key={player.id} className="text-lg font-bold">{player.name}</p>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{mostOwnedPlayer.percentage.toFixed(1)}% owned</p>
                    <p className="text-xs text-muted-foreground">{mostOwnedPlayer.count} teams</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {currentGameweek && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card className={benchBoostStatus.usedThisWeek ? "border-primary" : ""}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bench Boost</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your bench player's points will count for this gameweek
                  </p>
                  {benchBoostStatus.usedThisWeek ? (
                    <Badge variant="default" data-testid="chip-bench-boost-active">Active This Week</Badge>
                  ) : benchBoostStatus.canUse ? (
                    <Button 
                      onClick={() => activateChipMutation.mutate("BENCH_BOOST")}
                      disabled={activateChipMutation.isPending}
                      className="w-full"
                      data-testid="button-activate-bench-boost"
                    >
                      {activateChipMutation.isPending ? "Activating..." : "Activate Bench Boost"}
                    </Button>
                  ) : (
                    <Badge variant="outline" data-testid="chip-bench-boost-unavailable">
                      {benchBoostStatus.nextAvailableGW 
                        ? `Available GW ${benchBoostStatus.nextAvailableGW}`
                        : "Used"
                      }
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card className={tripleCaptainStatus.usedThisWeek ? "border-primary" : ""}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Triple Captain</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your captain will score triple points instead of double
                  </p>
                  {tripleCaptainStatus.usedThisWeek ? (
                    <Badge variant="default" data-testid="chip-triple-captain-active">Active This Week</Badge>
                  ) : tripleCaptainStatus.canUse ? (
                    <Button 
                      onClick={() => activateChipMutation.mutate("TRIPLE_CAPTAIN")}
                      disabled={activateChipMutation.isPending}
                      className="w-full"
                      data-testid="button-activate-triple-captain"
                    >
                      {activateChipMutation.isPending ? "Activating..." : "Activate Triple Captain"}
                    </Button>
                  ) : (
                    <Badge variant="outline" data-testid="chip-triple-captain-unavailable">
                      {tripleCaptainStatus.nextAvailableGW 
                        ? `Available GW ${tripleCaptainStatus.nextAvailableGW}`
                        : "Used"
                      }
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Your Squad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Starting XI</h3>
                  <div className="grid gap-2">
                    {teamPlayers?.filter(tp => !tp.isOnBench).map((tp) => (
                      <div
                        key={tp.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`player-${tp.player.name.toLowerCase().replace(' ', '-')}`}
                      >
                        <div className="flex items-center gap-3">
                          {tp.isCaptain && (
                            <Badge variant="default" className="font-mono" data-testid="badge-captain">
                              C
                            </Badge>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tp.player.name}</span>
                              {tp.player.isInForm && <Star className="h-3 w-3 text-primary fill-primary" />}
                            </div>
                            <span className="text-xs text-muted-foreground">{tp.player.position}</span>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-medium">{tp.player.price}M</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Bench</h3>
                  <div className="grid gap-2">
                    {teamPlayers?.filter(tp => tp.isOnBench).map((tp) => (
                      <div
                        key={tp.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/30"
                        data-testid={`bench-player-${tp.player.name.toLowerCase().replace(' ', '-')}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono" data-testid="badge-bench">
                            B
                          </Badge>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tp.player.name}</span>
                              {tp.player.isInForm && <Star className="h-3 w-3 text-primary fill-primary" />}
                            </div>
                            <span className="text-xs text-muted-foreground">{tp.player.position}</span>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-medium">{tp.player.price}M</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-center">
            <Button asChild data-testid="button-manage-squad">
              <Link href="/my-team">Manage Squad</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
