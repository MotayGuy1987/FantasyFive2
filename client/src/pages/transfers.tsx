import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PositionBadge } from "@/components/position-badge";
import { Repeat, Star, Search, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Team, Player, TeamPlayer, Gameweek } from "@shared/schema";

export default function Transfers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedOut, setSelectedOut] = useState<Player | null>(null);
  const [selectedIn, setSelectedIn] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const { data: team } = useQuery<Team>({
    queryKey: ["/api/team"],
    enabled: isAuthenticated,
  });

  const { data: currentGameweek } = useQuery<Gameweek>({
    queryKey: ["/api/gameweeks/current"],
    enabled: isAuthenticated,
  });

  const { data: teamPlayers } = useQuery<(TeamPlayer & { player: Player })[]>({
    queryKey: ["/api/team/players"],
    enabled: isAuthenticated && !!team,
  });

  const { data: allPlayers } = useQuery<Player[]>({
    queryKey: ["/api/players"],
    enabled: isAuthenticated,
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

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!team || !teamPlayers || teamPlayers.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-bold mb-2">No Squad Found</h2>
            <p className="text-muted-foreground mb-6">
              You need to build your squad before making transfers.
            </p>
            <Button asChild data-testid="button-build-squad">
              <a href="/squad">Build Squad</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPlayerIds = teamPlayers.map(tp => tp.player.id);
  const availablePlayers = allPlayers?.filter(p => !currentPlayerIds.includes(p.id)) || [];
  
  const filteredAvailable = availablePlayers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (!selectedOut || p.position === selectedOut.position)
  );

  const freeTransfers = team.freeTransfers || 0;
  const transferCost = freeTransfers > 0 ? 0 : -2;
  const canMakeTransfer = selectedOut && selectedIn && currentGameweek;

  const handleConfirmTransfer = () => {
    if (!canMakeTransfer) return;
    
    makeTransferMutation.mutate({
      playerOutId: selectedOut.id,
      playerInId: selectedIn.id,
      gameweekId: currentGameweek.id,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Transfers</h1>
          <p className="text-muted-foreground">
            Manage your squad by swapping players
          </p>
        </div>
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
      </div>

      {transferCost < 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have no free transfers remaining. This transfer will cost {transferCost} points.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Your Squad</span>
              <Repeat className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamPlayers.map((tp) => {
              const isSelectedOut = selectedOut?.id === tp.player.id;
              
              return (
                <div
                  key={tp.id}
                  className={`flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer ${
                    isSelectedOut ? 'bg-destructive/10 border-destructive' : 'hover-elevate'
                  }`}
                  onClick={() => {
                    if (isSelectedOut) {
                      setSelectedOut(null);
                      setSelectedIn(null);
                    } else {
                      setSelectedOut(tp.player);
                      setSelectedIn(null);
                    }
                  }}
                  data-testid={`squad-player-${tp.player.name.toLowerCase().replace(' ', '-')}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <PositionBadge position={tp.player.position} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{tp.player.name}</span>
                        {tp.player.isInForm && <Star className="h-3 w-3 text-primary fill-primary flex-shrink-0" />}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {tp.isCaptain && <Badge className="font-mono">C</Badge>}
                    {tp.isOnBench && <Badge variant="outline" className="font-mono">B</Badge>}
                    <span className="font-mono font-medium">{tp.player.price}M</span>
                    {isSelectedOut && (
                      <Badge variant="destructive" data-testid="badge-selected-out">Out</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedOut ? `Replace ${selectedOut.name}` : "Available Players"}
            </CardTitle>
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-transfers"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedOut ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select a player from your squad to transfer out
              </p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredAvailable.map((player) => {
                  const isSelectedIn = selectedIn?.id === player.id;
                  
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer ${
                        isSelectedIn ? 'bg-primary/10 border-primary' : 'hover-elevate'
                      }`}
                      onClick={() => setSelectedIn(player)}
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
                        {isSelectedIn && (
                          <Badge variant="default" data-testid="badge-selected-in">In</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canMakeTransfer && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Transfer Out</p>
                  <p className="font-bold">{selectedOut.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedOut.price}M</p>
                </div>
                <Repeat className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Transfer In</p>
                  <p className="font-bold">{selectedIn.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedIn.price}M</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {transferCost < 0 && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Points Cost</p>
                    <p className="text-xl font-bold font-mono text-destructive">{transferCost}</p>
                  </div>
                )}
                <Button
                  onClick={handleConfirmTransfer}
                  disabled={makeTransferMutation.isPending}
                  data-testid="button-confirm-transfer"
                >
                  {makeTransferMutation.isPending ? "Processing..." : "Confirm Transfer"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
