import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import { PositionBadge } from "@/components/position-badge";
import type { Player } from "@shared/schema";

interface PlayerStat {
  player: Player;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  isMotm: boolean;
  daysPlayed: number;
  penaltiesMissed: number;
  goalsConceded: number;
  points: number;
}

export default function Stats() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const { data: stats, isLoading } = useQuery<PlayerStat[]>({
    queryKey: ["/api/stats"],
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Player Stats</h1>
          <p className="text-muted-foreground">All Time Season Statistics</p>
        </div>
      </div>

      {!stats || stats.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No performance data available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Players Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">Goals</TableHead>
                    <TableHead className="text-center">Assists</TableHead>
                    <TableHead className="text-center">Yellow</TableHead>
                    <TableHead className="text-center">Red</TableHead>
                    <TableHead className="text-center">MOTM</TableHead>
                    <TableHead className="text-center">Days Played</TableHead>
                    <TableHead className="text-center">Penalties Missed</TableHead>
                    <TableHead className="text-center">Goals Conceded</TableHead>
                    <TableHead className="text-center">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((stat) => (
                    <TableRow key={stat.player.id} data-testid={`stat-row-${stat.player.name.toLowerCase().replace(' ', '-')}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PositionBadge position={stat.player.position} />
                          <span className="font-medium">{stat.player.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{stat.goals}</TableCell>
                      <TableCell className="text-center">{stat.assists}</TableCell>
                      <TableCell className="text-center">{stat.yellowCards}</TableCell>
                      <TableCell className="text-center">{stat.redCards}</TableCell>
                      <TableCell className="text-center">
                        {stat.isMotm ? "Yes" : "-"}
                      </TableCell>
                      <TableCell className="text-center">{stat.daysPlayed}</TableCell>
                      <TableCell className="text-center">{stat.penaltiesMissed}</TableCell>
                      <TableCell className="text-center">
                        {stat.player.position === "Defender" ? stat.goalsConceded : "-"}
                      </TableCell>
                      <TableCell className="text-center font-bold">{stat.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
