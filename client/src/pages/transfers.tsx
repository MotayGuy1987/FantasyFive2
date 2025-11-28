import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { validateTransfer } from "@/lib/positionValidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PositionBadge } from "@/components/position-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Search, AlertTriangle, Repeat, X } from "lucide-react";
import type { Team, Player, TeamPlayer, Gameweek } from "@shared/schema";

interface PendingTransfer {
  id: string;
  out: Player;
  in: Player;
}

export default function Transfers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedOut, setSelectedOut] = useState<Player | null>(null);
  const [selectedIn, setSelectedIn] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const { data: currentGameweek } = useQuery<Gameweek>({
    queryKey: ["/api/gameweeks/current"],
    enabled: isAuthenticated,
  });

  const { data: transfersData } = useQuery({
    queryKey: ["/api/transfers"],
    enabled: isAuthenticated,
  });

  const makeTransferMutation = useMutation({
    mutationFn: async (transfers: { playerOutId: string; playerInId: string; gameweekId: string }[]) => {
      for (const transfer of transfers) {
        const response = await fetch("/api/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transfer),
        });
        if (!response.ok) throw new Error(await response.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      setPendingTransfers([]);
      setSelectedOut(null);
      setSelectedIn(null);
      setConfirmOpen(false);
      toast({
        title: "Success",
        description: `${pendingTransfers.length} transfer(s) completed successfully!`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        window.location.href = "/api/login";
      } else {
        toast({
          title: "Transfer Failed",
          description: error.message,
          variant: "destructive",
        });
      }
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

  if (!existingTeamPlayers || existingTeamPlayers.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Build your first team to manage transfers.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedPlayerIds = new Set([
    ...pendingTransfers.flatMap(t => [t.out.id, t.in.id]),
    selectedOut?.id,
    selectedIn?.id,
  ].filter(Boolean));

  const selectedPlayers = existingTeamPlayers.map(tp => tp.player);
  const benchPlayerId = existingTeamPlayers.find(tp => tp.isOnBench)?.playerId ?? null;
  const usedPlayerOutIds = new Set(pendingTransfers.map(t => t.out.id));
  const usedPlayerInIds = new Set(pendingTransfers.map(t => t.in.id));
  
  const sortedSelectedPlayers = [...selectedPlayers]
    .filter(p => !usedPlayerOutIds.has(p.id))
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  
  const available = players?.filter(p => !selectedPlayers.some(sp => sp.id === p.id) && !usedPlayerInIds.has(p.id)) || [];
  const sortedAvailable = available
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

  const freeTransfers = team?.freeTransfers ?? 0;
  const totalSpent = selectedPlayers.reduce((sum, p) => sum + parseFloat(p.price), 0);
  const totalBudget = 50.0;
  const budgetRemain = totalBudget - totalSpent;

  const canAddTransfer = selectedOut && selectedIn;
  const transferValidation = selectedOut && selectedIn ? validateTransfer(selectedOut, selectedIn, selectedPlayers.filter(p => !usedPlayerOutIds.has(p.id)), benchPlayerId) : null;

  const addTransfer = () => {
    if (!canAddTransfer || !transferValidation?.canTransfer) return;
    
    const newTransferId = `${selectedOut.id}-${selectedIn.id}`;
    setPendingTransfers([...pendingTransfers, { id: newTransferId, out: selectedOut, in: selectedIn }]);
    setSelectedOut(null);
    setSelectedIn(null);
  };

  const removeTransfer = (id: string) => {
    setPendingTransfers(pendingTransfers.filter(t => t.id !== id));
  };

  const totalTransferCost = pendingTransfers.length > 0 
    ? (freeTransfers >= pendingTransfers.length ? 0 : (pendingTransfers.length - freeTransfers) * -2)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Repeat className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Transfers</h1>
          <p className="text-muted-foreground">Manage your team transfers</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Free Transfers</div>
            <div className="text-2xl font-bold font-mono text-primary">
              {freeTransfers >= 999 ? "∞" : freeTransfers}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {freeTransfers >= 999 ? "Unlimited this week" : (freeTransfers === 0 ? "Pending transfers: -2 pts each" : "Available")}
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Budget Available</div>
            <div className={`text-2xl font-bold font-mono ${budgetRemain >= 0 ? 'text-primary' : 'text-red-600 dark:text-red-400'}`}>
              £{budgetRemain.toFixed(1)}M
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {budgetRemain >= 0 ? "Can spend" : "Over budget"}
            </div>
          </div>
        </Card>
      </div>

      {totalTransferCost < 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {pendingTransfers.length} transfer(s) will cost {totalTransferCost} points total.
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
                <div key={player.id} className={`p-3 rounded-md border-2 transition-colors ${selectedOut?.id === player.id ? 'bg-red-600/25 border-red-600' : 'border-transparent hover:bg-muted'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <PositionBadge position={player.position} />
                    <span className="font-medium flex-1">{player.name}</span>
                    <span className="text-xs">£{player.price}M</span>
                  </div>
                  {selectedOut?.id === player.id ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {}}
                        disabled
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        data-testid={`button-select-out-${player.id}`}
                      >
                        Transfer Out
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedOut(null);
                          setSelectedIn(null);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white border-green-600"
                        data-testid={`button-bring-back-${player.id}`}
                      >
                        Bring Back
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setSelectedOut(player)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      data-testid={`button-select-out-${player.id}`}
                    >
                      Select to Transfer Out
                    </Button>
                  )}
                </div>
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
                <div key={player.id} className={`p-3 rounded-md border-2 transition-colors ${selectedIn?.id === player.id ? 'bg-green-600/25 border-green-600' : 'border-transparent hover:bg-muted'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <PositionBadge position={player.position} />
                    <span className="font-medium flex-1">{player.name}</span>
                    <span className="text-xs">£{player.price}M</span>
                  </div>
                  <Button
                    onClick={() => setSelectedIn(player)}
                    variant={selectedIn?.id === player.id ? "default" : "outline"}
                    size="sm"
                    className={`w-full ${selectedIn?.id === player.id ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                    data-testid={`button-select-in-${player.id}`}
                  >
                    {selectedIn?.id === player.id ? 'Transfer In' : 'Select to Transfer In'}
                  </Button>
                </div>
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
              Transfer Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md p-4 bg-muted/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-600 dark:text-red-400">OUT</div>
                  <div className="font-bold">{selectedOut.name}</div>
                  <div className="text-sm text-muted-foreground">£{selectedOut.price}M - {selectedOut.position}</div>
                </div>
                <Repeat className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-green-600 dark:text-green-400">IN</div>
                  <div className="font-bold">{selectedIn.name}</div>
                  <div className="text-sm text-muted-foreground">£{selectedIn.price}M - {selectedIn.position}</div>
                </div>
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
                onClick={addTransfer}
                disabled={!canAddTransfer || !transferValidation?.canTransfer}
                className="w-full"
                data-testid="button-add-transfer"
              >
                Add Transfer to Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pendingTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Transfers ({pendingTransfers.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {pendingTransfers.map((transfer) => (
                <div key={transfer.id} className="border rounded-md p-3 bg-muted/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">OUT</div>
                        <div className="font-medium">{transfer.out.name}</div>
                      </div>
                      <Repeat className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">IN</div>
                        <div className="font-medium">{transfer.in.name}</div>
                      </div>
                    </div>
                    <Button
                      onClick={() => removeTransfer(transfer.id)}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      data-testid={`button-remove-transfer-${transfer.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => setPendingTransfers([])}
                variant="outline"
                className="flex-1"
                data-testid="button-clear-all"
              >
                Clear All
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                className="flex-1"
                data-testid="button-confirm-all-transfers"
              >
                Confirm All Transfers
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {pendingTransfers.length} Transfer(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to proceed with these transfers?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2">
              {pendingTransfers.map((transfer, idx) => (
                <div key={transfer.id} className="border rounded-md p-3 bg-muted/50 text-sm">
                  <div className="font-medium mb-1">Transfer {idx + 1}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-red-600 dark:text-red-400">{transfer.out.name}</div>
                    <Repeat className="h-3 w-3" />
                    <div className="text-green-600 dark:text-green-400">{transfer.in.name}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border rounded-md p-3 bg-muted/50">
              <div className="flex justify-between items-center text-sm">
                <span>Total Cost</span>
                <span className={`font-mono font-bold ${totalTransferCost >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalTransferCost >= 0 ? "Free" : `${totalTransferCost} pts`}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setConfirmOpen(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-cancel-confirm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (currentGameweek) {
                    makeTransferMutation.mutate(
                      pendingTransfers.map(t => ({
                        playerOutId: t.out.id,
                        playerInId: t.in.id,
                        gameweekId: currentGameweek.id,
                      }))
                    );
                  }
                }}
                disabled={makeTransferMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-all"
              >
                {makeTransferMutation.isPending ? "Confirming..." : "Confirm All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
