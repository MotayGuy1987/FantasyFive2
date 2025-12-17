import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, DollarSign, Trophy, TrendingUp, Star, Shield, Target, Zap } from "lucide-react";
import type { Team, Player, TeamPlayer } from "@shared/schema";

interface SquadSelection {
  playerId: string;
  isStarter: boolean;
}

function SquadBuilder() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<SquadSelection[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [benchPlayer, setBenchPlayer] = useState<string | null>(null);

  const { data: players, isLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const createTeamMutation = useMutation({
    mutationFn: async (squadData: { playerIds: string[]; captain: string; bench: string }) => {
      return await apiRequest("POST", "/api/team", squadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Success", description: "Team created successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getPlayersByPosition = () => {
    if (!players) return { DEF: [], MID: [], FWD: [] };
    return {
      DEF: players.filter(p => p.position === 'Defender'), 
      MID: players.filter(p => p.position === 'Midfielder'),
      FWD: players.filter(p => p.position === 'Forward')
    };
  };

  const getStartingPositionCounts = () => {
    const starters = selectedPlayers.filter(sp => sp.isStarter);
    const counts = { DEF: 0, MID: 0, FWD: 0 };
    
    starters.forEach(sp => {
      const player = players?.find(p => p.id === sp.playerId);
      if (player) {
        const pos = player.position === 'Defender' ? 'DEF' :
                   player.position === 'Midfielder' ? 'MID' : 'FWD';
        counts[pos]++;
      }
    });
    
    return counts;
  };

  const canAddPlayer = (playerId: string, asStarter: boolean) => {
    const player = players?.find(p => p.id === playerId);
    if (!player) return false;

    const currentSelection = selectedPlayers.length;
    if (currentSelection >= 6) return false;

    if (asStarter) {
      const startersCount = selectedPlayers.filter(sp => sp.isStarter).length;
      if (startersCount >= 5) return false;
      return true;
    }

    return selectedPlayers.filter(sp => !sp.isStarter).length === 0; // Only 1 bench player
  };

  const canMoveToStarter = (playerId: string) => {
    const currentStarters = selectedPlayers.filter(sp => sp.isStarter).length;
    return currentStarters < 5;
  };

  const canMoveToBench = (playerId: string) => {
    const player = players?.find(p => p.id === playerId);
    if (!player) return false;

    // Check if removing this starter would break the "at least 1 of each position" rule
    const pos = player.position === 'Defender' ? 'DEF' :
               player.position === 'Midfielder' ? 'MID' : 'FWD';
    
    const counts = getStartingPositionCounts();
    counts[pos]--; // Simulate removing this player

    // Must have at least 1 of each position in starting XI
    return counts.DEF >= 1 && counts.MID >= 1 && counts.FWD >= 1;
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => {
      const existing = prev.find(sp => sp.playerId === playerId);
      
      if (existing) {
        // Remove player
        if (captain === playerId) setCaptain(null);
        if (benchPlayer === playerId) setBenchPlayer(null);
        return prev.filter(sp => sp.playerId !== playerId);
      } else {
        // Add player - try as starter first, then bench
        if (canAddPlayer(playerId, true)) {
          return [...prev, { playerId, isStarter: true }];
        } else if (canAddPlayer(playerId, false)) {
          setBenchPlayer(playerId); // Auto-set as bench player
          return [...prev, { playerId, isStarter: false }];
        }
        return prev;
      }
    });
  };

  const movePlayerToStarter = (playerId: string) => {
    if (!canMoveToStarter(playerId)) {
      toast({ title: "Cannot move to starter", description: "Starting XI is full (5 players)", variant: "destructive" });
      return;
    }

    setSelectedPlayers(prev => 
      prev.map(sp => sp.playerId === playerId ? { ...sp, isStarter: true } : sp)
    );

    if (benchPlayer === playerId) {
      setBenchPlayer(null);
    }
  };

  const movePlayerToBench = (playerId: string) => {
    if (!canMoveToBench(playerId)) {
      toast({ title: "Cannot bench player", description: "Must have at least 1 of each position starting", variant: "destructive" });
      return;
    }

    setSelectedPlayers(prev => 
      prev.map(sp => sp.playerId === playerId ? { ...sp, isStarter: false } : sp)
    );

    setBenchPlayer(playerId);
    if (captain === playerId) setCaptain(null); // Can't captain a bench player
  };

  const getTotalCost = () => {
    if (!players) return 0;
    return selectedPlayers.reduce((total, sp) => {
      const player = players.find(p => p.id === sp.playerId);
      return total + (player ? parseFloat(player.price) : 0);
    }, 0);
  };

  const isValidFormation = () => {
    const counts = getStartingPositionCounts();
    return counts.DEF >= 1 && counts.MID >= 1 && counts.FWD >= 1;
  };

  const canSubmit = () => {
    return selectedPlayers.length === 6 && 
           selectedPlayers.filter(sp => sp.isStarter).length === 5 &&
           selectedPlayers.filter(sp => !sp.isStarter).length === 1 &&
           captain && 
           benchPlayer && 
           isValidFormation() &&
           getTotalCost() <= 50;
  };

  if (isLoading) return <div className="p-6">Loading players...</div>;

  const positionGroups = getPlayersByPosition();
  const starterCount = selectedPlayers.filter(sp => sp.isStarter).length;
  const benchCount = selectedPlayers.filter(sp => !sp.isStarter).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Build Your Squad</h1>
        <p className="text-muted-foreground">Select 6 players (5 starters + 1 bench), must have 1+ of each position starting</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Squad Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Budget: £{getTotalCost().toFixed(1)}m / £50.0m</span>
            <span>Total: {selectedPlayers.length}/6</span>
          </div>
          <div className="flex justify-between">
            <span>Starters: {starterCount}/5</span>
            <span>Bench: {benchCount}/1</span>
          </div>
          <div className="text-sm">
            Formation: {getStartingPositionCounts().DEF}DEF-{getStartingPositionCounts().MID}MID-{getStartingPositionCounts().FWD}FWD
          </div>
          {!isValidFormation() && (
            <p className="text-sm text-red-500">⚠ Need at least 1 of each position starting</p>
          )}
        </CardContent>
      </Card>

      {Object.entries(positionGroups).map(([position, posPlayers]) => (
        <Card key={position}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {position === 'DEF' && <Shield className="h-5 w-5" />}
              {position === 'MID' && <Target className="h-5 w-5" />}
              {position === 'FWD' && <Zap className="h-5 w-5" />}
              <span>{position === 'DEF' ? 'Defenders' : position === 'MID' ? 'Midfielders' : 'Forwards'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {posPlayers.map((player) => {
                const selection = selectedPlayers.find(sp => sp.playerId === player.id);
                const isSelected = !!selection;
                const isStarter = selection?.isStarter || false;
                const isCaptain = captain === player.id;
                const isBench = benchPlayer === player.id;
                
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
                      
                      <div className="flex gap-1">
                        {isCaptain && <Badge><Star className="h-3 w-3 mr-1" />Captain</Badge>}
                        {isBench && <Badge variant="secondary">Bench</Badge>}
                        {isStarter && !isCaptain && !isBench && <Badge variant="outline">Starter</Badge>}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span>£{player.price}m</span>
                      
                      {isSelected && (
                        <div className="flex space-x-1">
                          {isStarter && (
                            <>
                              <Button
                                variant={isCaptain ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCaptain(captain === player.id ? null : player.id)}
                                disabled={isBench}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => movePlayerToBench(player.id)}
                              >
                                To Bench
                              </Button>
                            </>
                          )}
                          
                          {!isStarter && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => movePlayerToStarter(player.id)}
                            >
                              To Starter
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        onClick={() => {
          const allPlayerIds = selectedPlayers.map(sp => sp.playerId);
          createTeamMutation.mutate({ 
            playerIds: allPlayerIds, 
            captain: captain!, 
            bench: benchPlayer! 
          });
        }}
        disabled={!canSubmit() || createTeamMutation.isPending}
        size="lg"
        className="w-full"
      >
        {createTeamMutation.isPending ? "Creating..." : "Create Team"}
      </Button>

      {selectedPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Formation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {selectedPlayers.filter(sp => sp.isStarter).map((sp) => {
                  const player = players?.find(p => p.id === sp.playerId);
                  if (!player) return null;
                  
                  return (
                    <div key={sp.playerId} className="text-center p-2 border rounded bg-green-50">
                      <div className="text-sm font-medium">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                      {captain === sp.playerId && <Star className="h-3 w-3 mx-auto mt-1" />}
                    </div>
                  );
                })}
              </div>
              
              <div className="border-t pt-2">
                <div className="text-sm font-medium mb-2">Bench Player</div>
                {selectedPlayers.filter(sp => !sp.isStarter).map((sp) => {
                  const player = players?.find(p => p.id === sp.playerId);
                  if (!player) return null;
                  
                  return (
                    <div key={sp.playerId} className="text-center p-2 border rounded bg-yellow-50">
                      <div className="text-sm font-medium">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                      <Badge variant="secondary" className="mt-1">Bench</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MyTeam() {
  const { isAuthenticated } = useAuth();
  const [selectedChip, setSelectedChip] = useState<'bench_boost' | 'triple_captain' | null>(null);

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
        <Card>
          <CardContent className="p-12">
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to view your team.</p>
          </CardContent>
        </Card>
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
        </div>
      </div>
    );
  }

  // Show squad builder if no team exists
  if (!team || !teamPlayers || teamPlayers.length === 0) {
    return <SquadBuilder />;
  }

  // Show team management view
  const starters = teamPlayers.filter(tp => !tp.isOnBench);
  const bench = teamPlayers.filter(tp => tp.isOnBench);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Team</h1>
        <p className="text-muted-foreground">Manage your squad and powerups</p>
      </div>

      {/* Team Stats */}
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
            <div className="text-3xl font-bold">{teamPlayers?.length || 0}/6</div>
          </CardContent>
        </Card>
      </div>

      {/* Powerups/Chips */}
      <Card>
        <CardHeader>
          <CardTitle>Powerups</CardTitle>
          <p className="text-sm text-muted-foreground">Use strategic powerups to boost your points</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">Bench Boost</div>
                <div className="text-sm text-muted-foreground">Bench player gets points as if starting</div>
              </div>
              <Button 
                variant={selectedChip === 'bench_boost' ? 'default' : 'outline'}
                onClick={() => setSelectedChip(selectedChip === 'bench_boost' ? null : 'bench_boost')}
              >
                {selectedChip === 'bench_boost' ? 'Active' : 'Activate'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">Triple Captain</div>
                <div className="text-sm text-muted-foreground">Captain gets 3x points instead of 2x</div>
              </div>
              <Button 
                variant={selectedChip === 'triple_captain' ? 'default' : 'outline'}
                onClick={() => setSelectedChip(selectedChip === 'triple_captain' ? null : 'triple_captain')}
              >
                {selectedChip === 'triple_captain' ? 'Active' : 'Activate'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Starting XI */}
      <Card>
        <CardHeader>
          <CardTitle>Starting XI</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {starters.map((tp) => (
              <div key={tp.playerId} className="flex items-center justify-between p-3 border rounded bg-green-50">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{tp.player.name}</span>
                      {tp.isCaptain && (
                        <Badge>
                          <Star className="h-3 w-3 mr-1" />
                          Captain {selectedChip === 'triple_captain' ? '(3x)' : '(2x)'}
                        </Badge>
                      )}
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

      {/* Bench */}
      <Card>
        <CardHeader>
          <CardTitle>Bench</CardTitle>
        </CardHeader>
        <CardContent>
          {bench.map((tp) => (
            <div key={tp.playerId} className="flex items-center justify-between p-3 border rounded bg-yellow-50">
              <div className="flex items-center space-x-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{tp.player.name}</span>
                    <Badge variant="secondary">Bench</Badge>
                    {selectedChip === 'bench_boost' && (
                      <Badge variant="default">Boost Active</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {tp.player.position} • £{tp.player.price}m
                  </div>
                </div>
              </div>
              <div className="font-bold">0 pts</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
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
