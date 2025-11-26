import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { validateSquad, validateTransfer, POSITIONS } from "@/lib/positionValidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PositionBadge } from "@/components/position-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star, Users, TrendingUp, Search, Check, AlertTriangle, MoreVertical, Lock, Repeat } from "lucide-react";
import type { Team, Player, TeamPlayer, Gameweek, PlayerPerformance } from "@shared/schema";

const DEFAULT_BUDGET = 50.0;
const SQUAD_SIZE = 5;
const BENCH_SIZE = 1;

// Point calculation system (must match server calculation)
const POINT_MULTIPLIERS = {
  Defender: { goal: 6, assist: 3, yellowCard: -1, redCard: -2, straightRed: -3, motm: 3 },
  Midfielder: { goal: 5, assist: 3, yellowCard: -1, redCard: -2, straightRed: -3, motm: 3 },
  Forward: { goal: 5, assist: 3, yellowCard: -1, redCard: -2, straightRed: -3, motm: 3 },
};

function calculatePointsBreakdown(perf: PlayerPerformance, position: string): Record<string, number> {
  const multipliers = POINT_MULTIPLIERS[position as keyof typeof POINT_MULTIPLIERS] || POINT_MULTIPLIERS.Midfielder;
  
  return {
    goals: (perf.goals || 0) * multipliers.goal,
    assists: (perf.assists || 0) * multipliers.assist,
    yellowCards: (perf.yellowCards || 0) * multipliers.yellowCard,
    redCards: (perf.redCards || 0) * multipliers.redCard,
    motm: (perf.isMotm ? 1 : 0) * multipliers.motm,
  };
}

export default function MyTeam() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [benchPlayerId, setBenchPlayerId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [selectedOut, setSelectedOut] = useState<Player | null>(null);
  const [selectedIn, setSelectedIn] = useState<Player | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [bencedPlayerToSwap, setBencedPlayerToSwap] = useState<Player | null>(null);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [selectedPlayerPerf, setSelectedPlayerPerf] = useState<{ player: Player; perf: PlayerPerformance } | null>(null);

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

  const { data: players, isLoading: playersLoading, error: playersError } = useQuery<Player[]>({
    queryKey: ["/api/players"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (playersError) {
      console.error("Players query error:", playersError);
      toast({
        title: "Error Loading Players",
        description: playersError.message,
        variant: "destructive",
      });
    }
  }, [playersError, toast]);

  const { data: team } = useQuery<Team>({
    queryKey: ["/api/team"],
    enabled: isAuthenticated,
  });

  const { data: existingTeamPlayers } = useQuery<(TeamPlayer & { player: Player })[]>({
    queryKey: ["/api/team/players"],
    enabled: isAuthenticated && !!team,
  });

  const { data: currentGameweek } = useQuery<Gameweek>({
    queryKey: ["/api/gameweeks/current"],
    enabled: isAuthenticated,
  });

  const { data: gameweekScore } = useQuery<{ points: number }>({
    queryKey: ["/api/team/gameweek-score", currentGameweek?.id],
    enabled: isAuthenticated && !!currentGameweek,
  });

  const { data: playerPerformances } = useQuery<(PlayerPerformance & { player: Player })[]>({
    queryKey: ["/api/gameweek", currentGameweek?.id, "player-performances"],
    enabled: isAuthenticated && !!currentGameweek,
  });

  useEffect(() => {
    if (existingTeamPlayers && existingTeamPlayers.length > 0) {
      const players = existingTeamPlayers.map(tp => tp.player);
      setSelectedPlayers(players);
      const captain = existingTeamPlayers.find(tp => tp.isCaptain);
      if (captain) setCaptainId(captain.playerId);
      const bench = existingTeamPlayers.find(tp => tp.isOnBench);
      if (bench) setBenchPlayerId(bench.playerId);
      const teamName = team?.teamName;
      if (teamName) setTeamName(teamName);
    }
  }, [existingTeamPlayers, team]);

  // Auto-select bench player when 6 players are selected
  useEffect(() => {
    if (selectedPlayers.length === 6 && !benchPlayerId) {
      // Check which players are locked (only one of their position in starters)
      const validation = validateSquad(selectedPlayers, null);
      const lockedPlayerIds = validation.lockedPlayers;
      
      // Find the first non-locked, non-captain player to be bench
      const benchCandidate = selectedPlayers.find(p => 
        p.id !== captainId && !lockedPlayerIds.has(p.id)
      );
      
      if (benchCandidate) {
        setBenchPlayerId(benchCandidate.id);
      } else {
        // If all non-captain players are locked, just pick the last selected (non-captain)
        const nonCaptainPlayers = selectedPlayers.filter(p => p.id !== captainId);
        if (nonCaptainPlayers.length > 0) {
          setBenchPlayerId(nonCaptainPlayers[nonCaptainPlayers.length - 1].id);
        }
      }
    }
  }, [selectedPlayers.length, selectedPlayers]);

  const updateCaptainMutation = useMutation({
    mutationFn: async (newCaptainId: string) => {
      await apiRequest("PATCH", "/api/team/captain", { playerId: newCaptainId });
    },
    onMutate: async (newCaptainId: string) => {
      // Optimistically update the UI
      setCaptainId(newCaptainId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/players"] });
      toast({
        title: "Success",
        description: "Captain updated!",
      });
    },
  });

  const makeTransferMutation = useMutation({
    mutationFn: async (data: { playerOutId: string; playerInId: string; gameweekId: string }) => {
      await apiRequest("POST", "/api/transfers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      setSelectedOut(null);
      setSelectedIn(null);
      toast({
        title: "Success",
        description: "Transfer completed successfully!",
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

  const saveSquadMutation = useMutation({
    mutationFn: async () => {
      if (!teamName.trim()) {
        throw new Error("Team name is required");
      }
      if (selectedPlayers.length !== 6) {
        throw new Error("You must select exactly 6 players");
      }
      if (!captainId) {
        throw new Error("You must select a captain");
      }
      if (!benchPlayerId) {
        throw new Error("You must select a bench player");
      }
      
      const requestedPlayers = selectedPlayers.map((p, idx) => ({
        playerId: p.id,
        isCaptain: p.id === captainId,
        isOnBench: p.id === benchPlayerId,
        position: idx,
      }));
      
      await apiRequest("POST", "/api/team", { teamName, players: requestedPlayers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/players"] });
      toast({
        title: "Success",
        description: "Squad saved successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading || playersLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const currentPlayerIds = selectedPlayers.map(p => p.id);
  const availablePlayers = players?.filter(p => !currentPlayerIds.includes(p.id)) || [];
  
  const filteredAvailable = availablePlayers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const freeTransfers = team?.freeTransfers || 0;
  const transferCost = freeTransfers > 0 ? 0 : -2;
  
  const teamPlayersData = selectedPlayers.map(p => ({
    id: p.id,
    position: p.position,
    isOnBench: benchPlayerId === p.id,
  }));

  // Sort players by price (descending) with bench at bottom
  const sortedSelectedPlayers = [...selectedPlayers].sort((a, b) => {
    const aIsBench = benchPlayerId === a.id;
    const bIsBench = benchPlayerId === b.id;
    
    // If one is bench and other isn't, bench goes to bottom
    if (aIsBench && !bIsBench) return 1;
    if (!aIsBench && bIsBench) return -1;
    
    // Otherwise sort by price descending (highest first)
    const aPrice = parseFloat(String(a.price)) || 0;
    const bPrice = parseFloat(String(b.price)) || 0;
    return bPrice - aPrice;
  });

  // Sort available players by price descending
  const sortedAvailable = [...filteredAvailable].sort((a, b) => {
    const aPrice = parseFloat(String(a.price)) || 0;
    const bPrice = parseFloat(String(b.price)) || 0;
    return bPrice - aPrice;
  });

  const transferValidation = selectedOut && selectedIn ? validateTransfer(selectedOut.position, selectedIn.position, teamPlayersData) : null;
  const canMakeTransfer = selectedOut && selectedIn && currentGameweek && (transferValidation?.canTransfer ?? true);

  const handleConfirmTransfer = () => {
    if (!canMakeTransfer) return;
    
    makeTransferMutation.mutate({
      playerOutId: selectedOut!.id,
      playerInId: selectedIn!.id,
      gameweekId: currentGameweek!.id,
    });
  };

  const squadValidation = validateSquad(selectedPlayers, benchPlayerId);
  const budget = team?.budget ? parseFloat(String(team.budget)) : DEFAULT_BUDGET;
  const totalBudgetUsed = selectedPlayers.reduce((sum, p) => sum + (parseFloat(String(p.price)) || 0), 0);
  const budgetRemaining = budget - totalBudgetUsed;
  const isBudgetValid = totalBudgetUsed <= budget && budgetRemaining >= 0;
  const isSquadComplete = selectedPlayers.length === 6 && captainId && benchPlayerId && squadValidation.isValid && isBudgetValid;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Team</h1>
          <p className="text-muted-foreground">
            Manage your squad, set captains, and make transfers
          </p>
        </div>

        {selectedPlayers.length > 0 && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Budget Remaining</div>
                    <div className={`text-lg font-bold font-mono ${!isBudgetValid ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>£{budgetRemaining.toFixed(1)}M</div>
                    <div className="text-xs text-muted-foreground">of £{budget}M</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Squad</div>
                    <div className="text-lg font-bold font-mono">{selectedPlayers.length}/6</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Captain</div>
                    <div className="text-lg font-bold font-mono">{captainId ? "✓" : "–"}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Bench</div>
                    <div className="text-lg font-bold font-mono">{benchPlayerId ? "✓" : "–"}</div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="text-sm font-medium mb-3">Position Requirements (Starters)</div>
                  <div className="flex gap-2 mb-3">
                    <div className={`flex-1 p-3 rounded-md text-center ${squadValidation.positionCounts.Defender >= 1 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <div className="text-xs text-muted-foreground mb-1">DEF</div>
                      <div className={`text-2xl font-bold ${squadValidation.positionCounts.Defender >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {squadValidation.positionCounts.Defender}
                      </div>
                      <div className="text-xs text-muted-foreground">/1 required</div>
                    </div>
                    <div className={`flex-1 p-3 rounded-md text-center ${squadValidation.positionCounts.Midfielder >= 1 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <div className="text-xs text-muted-foreground mb-1">MID</div>
                      <div className={`text-2xl font-bold ${squadValidation.positionCounts.Midfielder >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {squadValidation.positionCounts.Midfielder}
                      </div>
                      <div className="text-xs text-muted-foreground">/1 required</div>
                    </div>
                    <div className={`flex-1 p-3 rounded-md text-center ${squadValidation.positionCounts.Forward >= 1 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <div className="text-xs text-muted-foreground mb-1">FWD</div>
                      <div className={`text-2xl font-bold ${squadValidation.positionCounts.Forward >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {squadValidation.positionCounts.Forward}
                      </div>
                      <div className="text-xs text-muted-foreground">/1 required</div>
                    </div>
                  </div>

                  {squadValidation.errors.length > 0 && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {squadValidation.errors.map((error, idx) => (
                            <li key={idx} className="text-xs">{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="Enter your team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={existingTeamPlayers && existingTeamPlayers.length > 0}
                data-testid="input-team-name"
              />
              {existingTeamPlayers && existingTeamPlayers.length > 0 && (
                <p className="text-xs text-muted-foreground">Team name is locked after squad is saved</p>
              )}
            </div>

            {selectedPlayers.length > 0 && (
              <Card className="p-4 bg-blue-500/5 border-blue-500/20">
                <div className="text-center space-y-3">
                  <div className="text-sm font-medium">Squad Builder Status</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {selectedPlayers.length < 6 && <div>Need {6 - selectedPlayers.length} more player{6 - selectedPlayers.length !== 1 ? 's' : ''}</div>}
                    {selectedPlayers.length === 6 && !captainId && <div>⚠️ Select a captain</div>}
                    {selectedPlayers.length === 6 && captainId && !benchPlayerId && <div>⚠️ Select a bench player</div>}
                    {selectedPlayers.length === 6 && captainId && benchPlayerId && !isBudgetValid && (
                      <div className="text-red-600 dark:text-red-400">⚠️ Budget exceeded</div>
                    )}
                    {selectedPlayers.length === 6 && captainId && benchPlayerId && !squadValidation.isValid && (
                      <div className="text-red-600 dark:text-red-400">⚠️ {squadValidation.errors[0]}</div>
                    )}
                    {isSquadComplete && <div className="text-green-600 dark:text-green-400 font-medium">✓ Ready to save!</div>}
                  </div>

                  <Button
                    onClick={() => saveSquadMutation.mutate()}
                    disabled={saveSquadMutation.isPending || !teamName.trim() || !isSquadComplete}
                    size="lg"
                    className="w-full mt-2"
                    data-testid="button-save-squad-main"
                  >
                    {saveSquadMutation.isPending ? "Saving..." : "Save Squad"}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="squad" className="space-y-6">
        <TabsList>
          <TabsTrigger value="squad">Squad</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="squad" className="space-y-6">
          {selectedPlayers.length < 6 && players && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Build Your Squad ({selectedPlayers.length}/6)
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">Select 5 starters and 1 bench player (Budget: £{budget.toFixed(1)}M)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {[...players].sort((a, b) => {
                    const aPrice = parseFloat(String(a.price)) || 0;
                    const bPrice = parseFloat(String(b.price)) || 0;
                    return bPrice - aPrice;
                  }).map((player) => {
                    const isSelected = selectedPlayers.some(p => p.id === player.id);
                    const isBench = benchPlayerId === player.id;
                    return (
                      <Button
                        key={player.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
                            if (benchPlayerId === player.id) setBenchPlayerId(null);
                            if (captainId === player.id) setCaptainId(null);
                          } else {
                            if (selectedPlayers.length < 6) {
                              setSelectedPlayers([...selectedPlayers, player]);
                            }
                          }
                        }}
                        variant={isSelected ? "default" : "outline"}
                        className="w-full justify-start"
                        disabled={selectedPlayers.length >= 6 && !isSelected}
                        data-testid={`button-squad-player-${player.id}`}
                      >
                        <PositionBadge position={player.position} />
                        <span className="ml-2 flex-1 text-left">{player.name}</span>
                        <span className="text-xs">£{player.price}M</span>
                        {isSelected && <Check className="h-4 w-4 ml-2" />}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {existingTeamPlayers && existingTeamPlayers.length > 0 && currentGameweek && gameweekScore && playerPerformances && (
            <Card>
              <CardHeader>
                <CardTitle>Gameweek {currentGameweek.number} Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center border-b pb-4">
                  <div className="text-xs text-muted-foreground mb-1">Team Total</div>
                  <div className="text-3xl font-bold text-primary">{gameweekScore?.points || 0} pts</div>
                </div>
                {selectedPlayers.length > 0 && playerPerformances && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {sortedSelectedPlayers.map((player) => {
                      const perf = playerPerformances.find(p => p.playerId === player.id);
                      const isBenched = player.id === benchPlayerId;
                      return (
                        <Button
                          key={player.id}
                          onClick={() => {
                            if (perf) {
                              setSelectedPlayerPerf({ player, perf });
                              setPerformanceModalOpen(true);
                            }
                          }}
                          variant="outline"
                          className="w-full justify-between p-2 h-auto"
                          data-testid={`button-player-perf-${player.id}`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <PositionBadge position={player.position} />
                            <span className="font-medium text-sm">{player.name}</span>
                            {isBenched && <Badge variant="outline" className="text-xs">Bench</Badge>}
                          </div>
                          <div className="font-mono text-sm font-bold text-primary">
                            {perf?.points || 0} pts
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Current Squad ({selectedPlayers.length}/6)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedSelectedPlayers.map((player) => {
                const isBench = benchPlayerId === player.id;
                const isCaptain = captainId === player.id;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      isBench 
                        ? 'bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/15' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <PositionBadge position={player.position} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{player.name}</p>
                        <p className="text-xs text-muted-foreground">£{player.price}M</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        {isBench && <Badge className="bg-blue-600 text-white dark:bg-blue-500">BENCH</Badge>}
                        {isCaptain && <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"><Star className="h-3 w-3 mr-1" />Captain</Badge>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-player-menu-${player.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isCaptain && !isBench && (
                          <>
                            <DropdownMenuItem onClick={() => updateCaptainMutation.mutate(player.id)}>
                              <Star className="h-4 w-4 mr-2" />
                              Make Captain
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => {
                          setBencedPlayerToSwap(player);
                          setSwapDialogOpen(true);
                        }}>
                          {isBench ? "Move to Starting XI" : "Move to Bench"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-6">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Free Transfers</div>
              <div className="text-2xl font-bold font-mono text-primary">
                {freeTransfers}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {freeTransfers === 0 ? "Next transfer: -2 pts" : "Available"}
              </div>
            </div>
          </Card>

          {transferCost < 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have no free transfers remaining. This transfer will cost {transferCost} points.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Players to Remove
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {sortedSelectedPlayers.map((player) => (
                    <Button
                      key={player.id}
                      onClick={() => setSelectedOut(player)}
                      variant={selectedOut?.id === player.id ? "default" : "outline"}
                      className="w-full justify-start"
                      data-testid={`button-select-out-${player.id}`}
                    >
                      <PositionBadge position={player.position} />
                      <span className="ml-2 flex-1 text-left">{player.name}</span>
                      <span className="text-xs">£{player.price}M</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Players to Add
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search available players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-transfers"
                />
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {sortedAvailable.map((player) => (
                    <Button
                      key={player.id}
                      onClick={() => setSelectedIn(player)}
                      variant={selectedIn?.id === player.id ? "default" : "outline"}
                      className="w-full justify-start"
                      data-testid={`button-select-in-${player.id}`}
                    >
                      <PositionBadge position={player.position} />
                      <span className="ml-2 flex-1 text-left">{player.name}</span>
                      <span className="text-xs">£{player.price}M</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedOut && selectedIn && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-5 w-5" />
                  Transfer Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Out</Label>
                    <div className="font-medium">{selectedOut.name}</div>
                    <PositionBadge position={selectedOut.position} />
                  </div>
                  <div className="flex items-end justify-center">
                    <Repeat className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">In</Label>
                    <div className="font-medium">{selectedIn.name}</div>
                    <PositionBadge position={selectedIn.position} />
                  </div>
                </div>

                {transferValidation && !transferValidation.canTransfer && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{transferValidation.reason}</AlertDescription>
                  </Alert>
                )}

                <div className="pt-4">
                  <Button
                    onClick={handleConfirmTransfer}
                    disabled={!canMakeTransfer || makeTransferMutation.isPending}
                    className="w-full"
                    data-testid="button-confirm-transfer"
                  >
                    {makeTransferMutation.isPending ? "Processing..." : `Confirm Transfer ${transferCost < 0 ? `(-${Math.abs(transferCost)} pts)` : "(Free)"}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={performanceModalOpen} onOpenChange={setPerformanceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlayerPerf?.player.name} - Performance Breakdown</DialogTitle>
            <DialogDescription>
              Gameweek {currentGameweek?.number} Points Calculation
            </DialogDescription>
          </DialogHeader>
          {selectedPlayerPerf && (
            <div className="space-y-4">
              <div className="text-center border-b pb-4">
                <div className="text-xs text-muted-foreground mb-1">Total Points</div>
                <div className="text-3xl font-bold text-primary">{selectedPlayerPerf.perf.points} pts</div>
              </div>
              <div className="space-y-3">
                {(() => {
                  const breakdown = calculatePointsBreakdown(selectedPlayerPerf.perf, selectedPlayerPerf.player.position);
                  const position = selectedPlayerPerf.player.position;
                  const multipliers = POINT_MULTIPLIERS[position as keyof typeof POINT_MULTIPLIERS] || POINT_MULTIPLIERS.Midfielder;
                  
                  return (
                    <>
                      {selectedPlayerPerf.perf.goals > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <div className="text-sm font-medium">Goals</div>
                            <div className="text-xs text-muted-foreground">{selectedPlayerPerf.perf.goals} × {multipliers.goal} pts</div>
                          </div>
                          <div className="font-mono font-bold text-primary">+{breakdown.goals}</div>
                        </div>
                      )}
                      {selectedPlayerPerf.perf.assists > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <div className="text-sm font-medium">Assists</div>
                            <div className="text-xs text-muted-foreground">{selectedPlayerPerf.perf.assists} × {multipliers.assist} pts</div>
                          </div>
                          <div className="font-mono font-bold text-primary">+{breakdown.assists}</div>
                        </div>
                      )}
                      {selectedPlayerPerf.perf.yellowCards > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <div className="text-sm font-medium">Yellow Cards</div>
                            <div className="text-xs text-muted-foreground">{selectedPlayerPerf.perf.yellowCards} × {multipliers.yellowCard} pts</div>
                          </div>
                          <div className="font-mono font-bold text-destructive">{breakdown.yellowCards}</div>
                        </div>
                      )}
                      {selectedPlayerPerf.perf.redCards > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <div className="text-sm font-medium">Red Cards</div>
                            <div className="text-xs text-muted-foreground">{selectedPlayerPerf.perf.redCards} × {multipliers.redCard} pts</div>
                          </div>
                          <div className="font-mono font-bold text-destructive">{breakdown.redCards}</div>
                        </div>
                      )}
                      {selectedPlayerPerf.perf.isMotm && (
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <div className="text-sm font-medium">Man of the Match</div>
                            <div className="text-xs text-muted-foreground">×{multipliers.motm} pts</div>
                          </div>
                          <div className="font-mono font-bold text-primary">+{breakdown.motm}</div>
                        </div>
                      )}
                      {selectedPlayerPerf.perf.goals === 0 && selectedPlayerPerf.perf.assists === 0 && selectedPlayerPerf.perf.yellowCards === 0 && selectedPlayerPerf.perf.redCards === 0 && !selectedPlayerPerf.perf.isMotm && (
                        <div className="text-center text-sm text-muted-foreground py-4">
                          No recorded statistics
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bench/Starter Swap</DialogTitle>
            <DialogDescription>
              {bencedPlayerToSwap && benchPlayerId === bencedPlayerToSwap.id
                ? `Bring ${bencedPlayerToSwap.name} back to starting XI - select which starter to move to the bench`
                : bencedPlayerToSwap 
                ? `Move ${bencedPlayerToSwap.name} to the bench - select which bench player to bring in`
                : 'Select a player to swap'}
            </DialogDescription>
          </DialogHeader>
          {bencedPlayerToSwap && (
            <div className="space-y-4">
              {(() => {
                // Allow any position swap as long as position requirements are met
                const isSwappingPlayerToBench = benchPlayerId === bencedPlayerToSwap.id ? false : true;
                
                return (
                  <>
                    {selectedPlayers
                      .filter(p => p.id !== bencedPlayerToSwap.id)
                      .map((player) => {
                        const isBench = player.id === benchPlayerId;
                        
                        // Simulate the swap to check if position requirements would be met
                        let tempBenchId: string | null = benchPlayerId;
                        if (isSwappingPlayerToBench) {
                          // Moving bencedPlayerToSwap to bench, so player becomes bench
                          tempBenchId = bencedPlayerToSwap.id;
                        } else {
                          // Bringing bencedPlayerToSwap to starters, so player becomes bench
                          tempBenchId = player.id;
                        }
                        
                        const swappedPlayers = selectedPlayers.map(p => {
                          if (p.id === bencedPlayerToSwap.id || p.id === player.id) {
                            return p; // Position stays same, just bench status changes
                          }
                          return p;
                        });
                        
                        const validation = validateSquad(swappedPlayers, tempBenchId);
                        const canSwap = validation.isValid;
                        const disabledReason = !canSwap ? validation.errors[0] : null;
                        
                        return (
                          <Button
                            key={player.id}
                            onClick={() => {
                              if (benchPlayerId === bencedPlayerToSwap.id) {
                                // Bringing bench player to starting XI
                                setBenchPlayerId(player.id);
                              } else {
                                // Moving starter to bench
                                setBenchPlayerId(bencedPlayerToSwap.id);
                              }
                              setSwapDialogOpen(false);
                            }}
                            variant={isBench ? "default" : "outline"}
                            disabled={!canSwap}
                            title={disabledReason || ""}
                            className="w-full justify-between"
                            data-testid={`button-swap-player-${player.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <PositionBadge position={player.position} />
                              {player.name}
                              {isBench && <Badge variant="outline" className="text-xs">Current Bench</Badge>}
                            </div>
                            <span className="text-xs">£{player.price}M</span>
                          </Button>
                        );
                      })}
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
