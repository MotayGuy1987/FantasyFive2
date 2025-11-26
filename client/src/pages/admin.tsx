import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Plus } from "lucide-react";
import { PositionBadge } from "@/components/position-badge";
import type { Player, Gameweek } from "@shared/schema";

interface PerformanceData {
  playerId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  isMotm: boolean;
  daysPlayed: number;
  penaltiesMissed: number;
  goalsConceded: number;
}

export default function Admin() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedGameweek, setSelectedGameweek] = useState<string>("");
  const [newGameweekNumber, setNewGameweekNumber] = useState("");
  const [performances, setPerformances] = useState<Record<string, PerformanceData>>({});

  const isAdmin = user && typeof user === 'object' && user !== null && 'email' in user && (user as any).email === "admin@admin.com";

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

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      window.location.href = "/";
    }
  }, [isAuthenticated, authLoading, isAdmin, toast]);

  const { data: players } = useQuery<Player[]>({
    queryKey: ["/api/players"],
    enabled: isAuthenticated && !!isAdmin,
  });

  const { data: gameweeks } = useQuery<Gameweek[]>({
    queryKey: ["/api/gameweeks"],
    enabled: isAuthenticated && !!isAdmin,
  });

  const { data: existingPerformances } = useQuery<(any & { player: Player })[]>({
    queryKey: ["/api/gameweek", selectedGameweek, "player-performances"],
    enabled: isAuthenticated && !!isAdmin && !!selectedGameweek,
  });

  const createGameweekMutation = useMutation({
    mutationFn: async (data: { number: number }) => {
      await apiRequest("POST", "/api/gameweeks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gameweeks"] });
      setNewGameweekNumber("");
      toast({
        title: "Success",
        description: "Gameweek created successfully!",
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

  const submitPerformancesMutation = useMutation({
    mutationFn: async (data: { gameweekId: string; performances: PerformanceData[] }) => {
      await apiRequest("POST", "/api/admin/performances", data);
    },
    onSuccess: () => {
      // Invalidate all caches to ensure all users see updated scores
      queryClient.invalidateQueries({ queryKey: ["/api/gameweeks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/gameweek-score"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      toast({
        title: "Success",
        description: "Performances submitted successfully! All managers are seeing the updated scores.",
      });
      setPerformances({});
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

  const endGameweekMutation = useMutation({
    mutationFn: async (gameweekId: string) => {
      await apiRequest("POST", "/api/admin/end-gameweek", { gameweekId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gameweeks"] });
      toast({
        title: "Success",
        description: "Gameweek ended and scores are confirmed!",
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

  useEffect(() => {
    if (players && Array.isArray(players) && selectedGameweek) {
      const initialPerformances: Record<string, PerformanceData> = {};
      players.forEach((player: Player) => {
        initialPerformances[player.id] = {
          playerId: player.id,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          isMotm: false,
          daysPlayed: 0,
          penaltiesMissed: 0,
          goalsConceded: 0,
        };
      });
      
      // Load existing performances if available
      if (existingPerformances && Array.isArray(existingPerformances)) {
        existingPerformances.forEach((perf: any) => {
          if (initialPerformances[perf.playerId]) {
            initialPerformances[perf.playerId] = {
              playerId: perf.playerId,
              goals: perf.goals || 0,
              assists: perf.assists || 0,
              yellowCards: perf.yellowCards || 0,
              redCards: perf.redCards || 0,
              isMotm: perf.isMotm || false,
              daysPlayed: perf.daysPlayed || 0,
              penaltiesMissed: perf.penaltiesMissed || 0,
              goalsConceded: perf.goalsConceded || 0,
            };
          }
        });
      }
      
      setPerformances(initialPerformances);
    }
  }, [players, selectedGameweek, existingPerformances]);

  const updatePerformance = (playerId: string, field: keyof PerformanceData, value: number | boolean) => {
    setPerformances((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }));
  };

  const handleSubmitPerformances = () => {
    if (!selectedGameweek) {
      toast({
        title: "Error",
        description: "Please select a gameweek",
        variant: "destructive",
      });
      return;
    }

    const performancesArray = Object.values(performances);
    submitPerformancesMutation.mutate({
      gameweekId: selectedGameweek,
      performances: performancesArray,
    });
  };

  const handleCreateGameweek = () => {
    const number = parseInt(newGameweekNumber);
    if (isNaN(number) || number < 1) {
      toast({
        title: "Error",
        description: "Please enter a valid gameweek number",
        variant: "destructive",
      });
      return;
    }
    createGameweekMutation.mutate({ number });
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage gameweeks and player performances</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Gameweek</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="gameweek-number">Gameweek Number</Label>
              <Input
                id="gameweek-number"
                type="number"
                placeholder="Enter gameweek number"
                value={newGameweekNumber}
                onChange={(e) => setNewGameweekNumber(e.target.value)}
                data-testid="input-gameweek-number"
              />
            </div>
            <Button
              onClick={handleCreateGameweek}
              disabled={createGameweekMutation.isPending}
              className="w-full"
              data-testid="button-create-gameweek"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createGameweekMutation.isPending ? "Creating..." : "Create Gameweek"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Select Gameweek</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="select-gameweek">Gameweek</Label>
            <Select value={selectedGameweek} onValueChange={setSelectedGameweek}>
              <SelectTrigger id="select-gameweek" data-testid="select-gameweek">
                <SelectValue placeholder="Select gameweek" />
              </SelectTrigger>
              <SelectContent>
                {gameweeks && Array.isArray(gameweeks) && gameweeks.map((gw: Gameweek) => (
                  <SelectItem key={gw.id} value={gw.id} data-testid={`option-gameweek-${gw.number}`}>
                    Gameweek {gw.number} {gw.isActive ? "(Active)" : gw.isCompleted ? "(Completed)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {selectedGameweek && (
        <Card>
          <CardHeader>
            <CardTitle>Player Performances</CardTitle>
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
                    <TableHead className="text-center">Goals Conceded (DEF)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players && Array.isArray(players) && players.map((player: Player) => (
                    <TableRow key={player.id} data-testid={`performance-row-${player.name.toLowerCase().replace(' ', '-')}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PositionBadge position={player.position} />
                          <span className="font-medium">{player.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={performances[player.id]?.goals || 0}
                          onChange={(e) => updatePerformance(player.id, "goals", parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-goals-${player.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={performances[player.id]?.assists || 0}
                          onChange={(e) => updatePerformance(player.id, "assists", parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-assists-${player.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={performances[player.id]?.yellowCards || 0}
                          onChange={(e) => updatePerformance(player.id, "yellowCards", parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-yellow-${player.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={performances[player.id]?.redCards || 0}
                          onChange={(e) => updatePerformance(player.id, "redCards", parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-red-${player.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={performances[player.id]?.isMotm || false}
                          onCheckedChange={(checked) => updatePerformance(player.id, "isMotm", checked as boolean)}
                          data-testid={`checkbox-motm-${player.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={performances[player.id]?.daysPlayed || 0}
                          onChange={(e) => updatePerformance(player.id, "daysPlayed", parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-days-${player.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={performances[player.id]?.penaltiesMissed || 0}
                          onChange={(e) => updatePerformance(player.id, "penaltiesMissed", parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-penalties-${player.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        {player.position === "Defender" ? (
                          <Input
                            type="number"
                            min="0"
                            value={performances[player.id]?.goalsConceded || 0}
                            onChange={(e) => updatePerformance(player.id, "goalsConceded", parseInt(e.target.value) || 0)}
                            className="w-20 text-center"
                            data-testid={`input-conceded-${player.id}`}
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 space-y-3">
              <Button
                onClick={handleSubmitPerformances}
                disabled={submitPerformancesMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-submit-performances"
              >
                {submitPerformancesMutation.isPending ? "Submitting..." : "Submit Performances"}
              </Button>
              <Button
                onClick={() => {
                  if (selectedGameweek) {
                    endGameweekMutation.mutate(selectedGameweek);
                  }
                }}
                disabled={endGameweekMutation.isPending || !selectedGameweek}
                className="w-full"
                size="lg"
                variant="secondary"
                data-testid="button-end-gameweek"
              >
                {endGameweekMutation.isPending ? "Ending..." : "End Gameweek"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
