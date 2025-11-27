import { useEffect, useState } from "react";
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
import { BarChart3, ArrowUp, ArrowDown } from "lucide-react";
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
  ownedPercentage: number;
}

type SortField = "price" | "owned" | "goals" | "assists" | "yellow" | "red" | "days" | "penalties" | "conceded" | "points";
type SortDirection = "asc" | "desc";

export default function Stats() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortedStats = () => {
    if (!stats) return [];

    const sorted = [...stats].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "price":
          aValue = parseFloat(a.player.price);
          bValue = parseFloat(b.player.price);
          break;
        case "owned":
          aValue = a.ownedPercentage;
          bValue = b.ownedPercentage;
          break;
        case "goals":
          aValue = a.goals;
          bValue = b.goals;
          break;
        case "assists":
          aValue = a.assists;
          bValue = b.assists;
          break;
        case "yellow":
          aValue = a.yellowCards;
          bValue = b.yellowCards;
          break;
        case "red":
          aValue = a.redCards;
          bValue = b.redCards;
          break;
        case "days":
          aValue = a.daysPlayed;
          bValue = b.daysPlayed;
          break;
        case "penalties":
          aValue = a.penaltiesMissed;
          bValue = b.penaltiesMissed;
          break;
        case "conceded":
          aValue = a.goalsConceded;
          bValue = b.goalsConceded;
          break;
        case "points":
          aValue = a.points;
          bValue = b.points;
          break;
        default:
          return 0;
      }

      if (sortDirection === "desc") {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });

    return sorted;
  };

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortField === field;
    return (
      <TableHead 
        className="text-center cursor-pointer hover:bg-muted/50" 
        onClick={() => handleSort(field)}
        data-testid={`sort-${field}`}
      >
        <div className="flex items-center justify-center gap-1">
          {label}
          {isActive && (
            sortDirection === "desc" ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            )
          )}
        </div>
      </TableHead>
    );
  };

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
                    <SortableHeader field="price" label="Price" />
                    <SortableHeader field="owned" label="% Owned" />
                    <SortableHeader field="goals" label="Goals" />
                    <SortableHeader field="assists" label="Assists" />
                    <SortableHeader field="yellow" label="Yellow" />
                    <SortableHeader field="red" label="Red" />
                    <TableHead className="text-center">MOTM</TableHead>
                    <SortableHeader field="days" label="Days Played" />
                    <SortableHeader field="penalties" label="Penalties Missed" />
                    <SortableHeader field="conceded" label="Goals Conceded" />
                    <SortableHeader field="points" label="Points" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedStats().map((stat) => (
                    <TableRow key={stat.player.id} data-testid={`stat-row-${stat.player.name.toLowerCase().replace(' ', '-')}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PositionBadge position={stat.player.position} />
                          <span className="font-medium">{stat.player.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">£{stat.player.price}M</TableCell>
                      <TableCell className="text-center">{stat.ownedPercentage.toFixed(1)}%</TableCell>
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
