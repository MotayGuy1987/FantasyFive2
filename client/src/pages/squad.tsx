import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { validateSquad, POSITIONS } from "@/lib/positionValidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PositionBadge } from "@/components/position-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, Users, TrendingUp, Search, Check, AlertTriangle } from "lucide-react";
import type { Team, Player, TeamPlayer } from "@shared/schema";

const BUDGET = 50.0;
const SQUAD_SIZE = 5;
const BENCH_SIZE = 1;

export default function Squad() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [benchPlayerId, setBenchPlayerId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");

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

  const { data: players, isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
    enabled: isAuthenticated,
  });

  const { data: team } = useQuery<Team>({
    queryKey: ["/api/team"],
    enabled: isAuthenticated,
  });

  const { data: existingTeamPlayers } = useQuery<(TeamPlayer & { player: Player })[]>({
    queryKey: ["/api/team/players"],
    enabled: isAuthenticated && !!team,
  });

  useEffect(() => {
    if (existingTeamPlayers && existingTeamPlayers.length > 0) {
      const players = existingTeamPlayers.map(tp => tp.player);
      setSelectedPlayers(players);
      const captain = existingTeamPlayers.find(tp => tp.isCaptain);
      if (captain) setCaptainId(captain.playerId);
      const bench = existingTeamPlayers.find(tp => tp.isOnBench);
      if (bench) setBenchPlayerId(bench.playerId);
    }
  }, [existingTeamPlayers]);

  useEffect(() => {
    if (user && typeof user === 'object' && user !== null && 'teamName' in user) {
      const userData = user as any;
      setTeamName(userData.teamName || "");
    }
  }, [user]);

  const saveTeamMutation = useMutation({
    mutationFn: async (data: { teamName: string; players: { playerId: string; isCaptain: boolean; isOnBench: boolean; position: number }[] }) => {
      await apiRequest("POST", "/api/team", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Your squad has been saved!",
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

  const totalSpent = selectedPlayers.reduce((sum, p) => sum + parseFloat(p.price), 0);
  const remaining = BUDGET - totalSpent;
  
  const squadValidation = validateSquad(selectedPlayers.map(p => ({ id: p.id, position: p.position, isOnBench: p.id === benchPlayerId })), benchPlayerId);
  const isValidSquad = selectedPlayers.length === (SQUAD_SIZE + BENCH_SIZE) && 
                       captainId !== null && 
                       benchPlayerId !== null &&
                       teamName.trim().length > 0 &&
                       squadValidation.isValid &&
                       remaining >= 0;

  const togglePlayer = (player: Player) => {
    if (selectedPlayers.find(p => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
      if (captainId === player.id) setCaptainId(null);
      if (benchPlayerId === player.id) setBenchPlayerId(null);
    } else {
      if (selectedPlayers.length < SQUAD_SIZE + BENCH_SIZE) {
        setSelectedPlayers([...selectedPlayers, player]);
      } else {
        toast({
          title: "Squad Full",
          description: "Remove a player before adding another",
          variant: "destructive",
        });
      }
    }
  };

  const handleSaveSquad = () => {
    if (!isValidSquad) return;

    const playersData = selectedPlayers.map((player, index) => ({
      playerId: player.id,
      isCaptain: player.id === captainId,
      isOnBench: player.id === benchPlayerId,
      position: index,
    }));

    saveTeamMutation.mutate({ teamName, players: playersData });
  };

  const filteredPlayers = players?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = positionFilter === "All" || p.position === positionFilter;
    return matchesSearch && matchesPosition;
  }) || [];

  const starterPlayers = selectedPlayers.filter(p => p.id !== benchPlayerId);

  if (authLoading || playersLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Squad Builder</h1>
          <p className="text-muted-foreground">
            Pick {SQUAD_SIZE} starters and {BENCH_SIZE} bench player within {BUDGET}M budget
          </p>
        </div>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Budget Remaining</div>
            <div className={`text-2xl font-bold font-mono ${remaining < 0 ? 'text-destructive' : 'text-primary'}`}>
              {remaining.toFixed(1)}M
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalSpent.toFixed(1)}M / {BUDGET}M spent
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  placeholder="Enter your team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  data-testid="input-team-name"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Your Squad ({selectedPlayers.length}/{SQUAD_SIZE + BENCH_SIZE})</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No players selected yet. Pick players from the list.
                </p>
              ) : (
                <>
                  {squadValidation.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {squadValidation.errors.map((error, i) => (
                            <li key={i} className="text-sm">{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">DEF</div>
                      <div className={`text-2xl font-bold ${squadValidation.positionCounts[POSITIONS.DEF] >= 1 ? 'text-primary' : 'text-destructive'}`}>
                        {squadValidation.positionCounts[POSITIONS.DEF]}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">MID</div>
                      <div className={`text-2xl font-bold ${squadValidation.positionCounts[POSITIONS.MID] >= 1 ? 'text-primary' : 'text-destructive'}`}>
                        {squadValidation.positionCounts[POSITIONS.MID]}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">FWD</div>
                      <div className={`text-2xl font-bold ${squadValidation.positionCounts[POSITIONS.FWD] >= 1 ? 'text-primary' : 'text-destructive'}`}>
                        {squadValidation.positionCounts[POSITIONS.FWD]}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Starting XI ({starterPlayers.length}/{SQUAD_SIZE})</h3>
                    <div className="space-y-2">
                      {starterPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                          data-testid={`selected-player-${player.name.toLowerCase().replace(' ', '-')}`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <PositionBadge position={player.position} />
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">{player.name}</span>
                              {player.isInForm && <Star className="h-3 w-3 text-primary fill-primary flex-shrink-0" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono text-sm">{player.price}M</span>
                            {player.id === captainId ? (
                              <Badge variant="default" className="font-mono cursor-pointer" data-testid={`badge-captain-${player.id}`}>
                                C
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCaptainId(player.id)}
                                data-testid={`button-set-captain-${player.id}`}
                              >
                                Set C
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePlayer(player)}
                              data-testid={`button-remove-${player.id}`}
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Bench ({benchPlayerId ? '1' : '0'}/{BENCH_SIZE})</h3>
                    <div className="space-y-2">
                      {selectedPlayers.filter(p => p.id === benchPlayerId).map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                          data-testid={`bench-selected-${player.name.toLowerCase().replace(' ', '-')}`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <PositionBadge position={player.position} />
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">{player.name}</span>
                              {player.isInForm && <Star className="h-3 w-3 text-primary fill-primary flex-shrink-0" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono text-sm">{player.price}M</span>
                            <Badge variant="outline" className="font-mono" data-testid="badge-bench">
                              B
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePlayer(player)}
                              data-testid={`button-remove-bench-${player.id}`}
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))}
                      {selectedPlayers.filter(p => p.id !== benchPlayerId && p.id !== captainId).slice(0, BENCH_SIZE).map((player) => (
                        <Button
                          key={player.id}
                          variant="outline"
                          size="sm"
                          onClick={() => setBenchPlayerId(player.id)}
                          className="w-full justify-start"
                          data-testid={`button-set-bench-${player.id}`}
                        >
                          Move {player.name} to bench
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button
                className="w-full"
                onClick={handleSaveSquad}
                disabled={!isValidSquad || saveTeamMutation.isPending}
                data-testid="button-save-squad"
              >
                {saveTeamMutation.isPending ? "Saving..." : "Save Squad"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Players</CardTitle>
            <div className="flex gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-players"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={positionFilter} onValueChange={setPositionFilter}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="All" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="Defender" data-testid="tab-defender">DEF</TabsTrigger>
                <TabsTrigger value="Midfielder" data-testid="tab-midfielder">MID</TabsTrigger>
                <TabsTrigger value="Forward" data-testid="tab-forward">FWD</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
              {filteredPlayers.map((player) => {
                const isSelected = selectedPlayers.some(p => p.id === player.id);
                const canAfford = remaining + (isSelected ? parseFloat(player.price) : 0) >= parseFloat(player.price);

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : canAfford
                        ? 'hover-elevate'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => canAfford && togglePlayer(player)}
                    data-testid={`available-player-${player.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <PositionBadge position={player.position} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{player.name}</span>
                          {player.isInForm && <Star className="h-3 w-3 text-primary fill-primary flex-shrink-0" />}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono font-medium">{player.price}M</span>
                      {isSelected && (
                        <Badge variant="default" data-testid={`badge-selected-${player.id}`}>
                          <Check className="h-3 w-3 mr-1" />
                          Added
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
