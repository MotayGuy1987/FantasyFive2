import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, DollarSign, Trophy, TrendingUp, Star } from "lucide-react";
import type { Team, Player, TeamPlayer } from "@shared/schema";

function SquadBuilder() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [bench, setBench] = useState<string | null>(null);

  const { data: players, isLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const createTeamMutation = useMutation({
    mutationFn: async (playerIds: string[]) => {
      return await apiRequest("POST", "/api/team", { playerIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Success", description: "Team created successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        if (captain === playerId) setCaptain(null);
        if (bench === playerId) setBench(null);
        return prev.filter(id => id !== playerId);
      } else {
        if (prev.length >= 5) {
          toast({ title: "Squad Full", description: "Max 5 players", variant: "destructive" });
          return prev;
        }
        return [...prev, playerId];
      }
    });
  };

  const getTotalCost = () => {
    if (!players) return 0;
    return selectedPlayers.reduce((total, playerId) => {
      const player = players.find(p => p.id === playerId);
      return total + (player ? parseFloat(player.price) : 0);
    }, 0);
  };

  const canSubmit = () => {
    return selectedPlayers.length === 5 && captain && bench && getTotalCost() <= 50;
  };

  if (isLoading) return <div className="p-6">Loading players...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Build Your Squad</h1>
        <p className="text-muted-foreground">Select 5 players, choose captain & bench</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Squad Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            <span>Budget: £{getTotalCost().toFixed(1)}m / £50.0m</span>
            <span>Players: {selectedPlayers.length}/5</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {players?.map((player) => {
              const isSelected = selectedPlayers.includes(player.id);
              const isCaptain = captain === player.id;
              const isBench = bench === player.id;
              
              return (
                <div key={player.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePlayer(player.id)}
                    >
                      {isSelected ? "Remove" : "Add"}
                    </Button>
                    <div>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-muted-foreground">{player.position}</div>
                    </div>
                    {isCaptain && <Badge>Captain</Badge>}
                    {isBench && <Badge variant="secondary">Bench</Badge>}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span>£{player.price}m</span>
                    {isSelected && (
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCaptain(captain === player.id ? null : player.id)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBench(bench === player.id ? null : player.id)}
                        >
                          B
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => createTeamMutation.mutate(selectedPlayers)}
        disabled={!canSubmit() || createTeamMutation.isPending}
        size="lg"
        className="w-full"
      >
        {createTeamMutation.isPending ? "Creating..." : "Create Team"}
      </Button>
    </div>
  );
}

export default function MyTeam() {
  const { isAuthenticated } = useAuth();

  const { data: team, isLoading: teamLoading } = useQuery<Team>({
    queryKey: ["/api/team"],
    enabled: isAuthenticated,
  });

  const { data: teamPlayers, isLoading: playersLoading } = useQuery<(TeamPlayer & { player: Player })[]>({
    queryKey: ["/api/team/players"],
    enabled: isAuthenticated && !!team,
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
        <Skeleton className="h-32" />
      </div>
    );
  }

  // Show squad builder if no team exists
  if (!team || !teamPlayers || teamPlayers.length === 0) {
    return <SquadBuilder />;
  }

  // Show team management view
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Team</h1>
        <p className="text-muted-foreground">Manage your squad</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{team.totalPoints || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Transfers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{team.freeTransfers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">£{team.budget || 0}m</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Squad Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teamPlayers?.length || 0}/5</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Squad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamPlayers?.map((tp) => (
              <div key={tp.playerId} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{tp.player.name}</span>
                      {tp.isCaptain && <Badge><Star className="h-3 w-3 mr-1" />Captain</Badge>}
                      {tp.isOnBench && <Badge variant="secondary">Bench</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tp.player.position} • £{tp.player.price}m
                    </div>
                  </div>
                </div>
                <div className="font-bold">0 pts</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.href = '/transfers'}>
              Make Transfers
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/leagues'}>
              Join League
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/stats'}>
              View Stats
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
