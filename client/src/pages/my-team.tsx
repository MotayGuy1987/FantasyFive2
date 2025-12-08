import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown, Users, DollarSign, Trophy, Star, TrendingUp, TrendingDown } from "lucide-react";
import type { Team, Player, TeamPlayer, PlayerPerformance, Gameweek } from "@shared/schema";
import { POINT_MULTIPLIERS } from "@/lib/teams";

function calculatePointsBreakdown(perf: PlayerPerformance, position: string): Record<string, number> {
  const multipliers = POINT_MULTIPLIERS[position as keyof typeof POINT_MULTIPLIERS] || POINT_MULTIPLIERS.Midfielder;

  // days played points must match server rules:
  // 1-3 days -> +1, 4+ days -> +2
  const days = perf.daysPlayed || 0;
  let daysPlayedPoints = 0;
  if (days >= 1 && days <= 3) {
    daysPlayedPoints = 1;
  } else if (days >= 4) {
    daysPlayedPoints = 2;
  }

  return {
    goals: (perf.goals || 0) * multipliers.goal,
    assists: (perf.assists || 0) * multipliers.assist,
    yellowCards: (perf.yellowCards || 0) * multipliers.yellowCard,
    redCards: (perf.redCards || 0) * multipliers.redCard,
    motm: (perf.isMotm ? 1 : 0) * multipliers.motm,
    daysPlayed: daysPlayedPoints,
  };
}

export default function MyTeam() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [selectedGameweek, setSelectedGameweek] = useState<string | null>(null);

  const { data: team, isLoading: teamLoading } = useQuery<Team>({
    queryKey: ["/api/team"],
    enabled: isAuthenticated,
  });

  const { data: teamPlayers, isLoading: playersLoading } = useQuery<(TeamPlayer & { player: Player })[]>({
    queryKey: ["/api/team/players"],
    enabled: isAuthenticated && !!team,
  });

  const { data: currentGameweek } = useQuery<Gameweek>({
    queryKey: ["/api/gameweeks/current"],
    enabled: isAuthenticated,
  });

  const { data: allGameweeks } = useQuery<Gameweek[]>({
    queryKey: ["/api/gameweeks"],
    enabled: isAuthenticated,
  });

  const activeGameweekId = selectedGameweek || currentGameweek?.id;

  const { data: playerPerformances } = useQuery<(PlayerPerformance & { player: Player })[]>({
    queryKey: ["/api/player-performances", activeGameweekId],
    enabled: isAuthenticated && !!activeGameweekId,
  });

  const { data: teamScore } = useQuery<{ points: number }>({
    queryKey: ["/api/team/gameweek-score", activeGameweekId],
    enabled: isAuthenticated && !!activeGameweekId && !!team,
  });

  if (!isAuthenticated) {
    return (
      <div className="p-6 text-center">
        <p>Please log in to view your team.</p>
      </div>
    );
  }

  if (teamLoading || playersLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!team || !teamPlayers || teamPlayers.length === 0) {
    return (
      <div className="p-6 text-center">
        <Card>
          <CardContent className="p-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
              <Users className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Team Found</h2>
            <p className="text-muted-foreground mb-6">
              You haven't created a team yet. Build your squad to get started!
            </p>
            <Button size="lg">Build Your Squad</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const starters = teamPlayers.filter(tp => !tp.isOnBench);
  const bench = teamPlayers.filter(tp => tp.isOnBench);
  const captain = teamPlayers.find(tp => tp.isCaptain);

  const playerPerformanceMap = new Map(
    playerPerformances?.map(perf => [perf.playerId, perf]) || []
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Team</h1>
          <p className="text-muted-foreground">Manage your squad and view performance</p>
        </div>
        {allGameweeks && allGameweeks.length > 0 && (
          <select
            value={selectedGameweek || currentGameweek?.id || ""}
            onChange={(e) => setSelectedGameweek(e.target.value || null)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            {allGameweeks.map((gw) => (
              <option key={gw.id} value={gw.id}>
                Gameweek {gw.number} {gw.id === currentGameweek?.id ? "(Current)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gameweek Points</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teamScore?.points || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{team.totalPoints || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Transfers</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{team.freeTransfers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Value</CardTitle>
            <DollarSign className="h-4
