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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Plus, LogIn, Copy, Check, Trash2, User as UserIcon } from "lucide-react";
import { COUNTRY_FLAGS, TEAM_LOGOS } from "@/lib/teams";
import type { League, Team, Gameweek, User } from "@shared/schema";

interface LeaderboardEntry {
  rank: number;
  teamName: string;
  totalPoints: number;
  gameweekPoints: number;
  userId?: string;
  firstName?: string;
  nationality?: string;
  favoriteTeam?: string;
  profileImageUrl?: string;
  avatarPersonColor?: string;
  avatarBgColor?: string;
}

export default function Leagues() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const { data: myLeagues } = useQuery<League[]>({
    queryKey: ["/api/leagues"],
    enabled: isAuthenticated && !!team,
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leagues", selectedLeagueId, "leaderboard"],
    enabled: !!selectedLeagueId,
    staleTime: 0, // Always fetch fresh data
    refetchInterval: 10000, // Refetch every 10 seconds for live updates
    refetchIntervalInBackground: true,
  });

  const createLeagueMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", "/api/leagues", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setCreateDialogOpen(false);
      setNewLeagueName("");
      toast({
        title: "Success",
        description: "League created successfully!",
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

  const joinLeagueMutation = useMutation({
    mutationFn: async (data: { joinCode: string }) => {
      await apiRequest("POST", "/api/leagues/join", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setJoinDialogOpen(false);
      setJoinCode("");
      toast({
        title: "Success",
        description: "Joined league successfully!",
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

  const deleteLeagueMutation = useMutation({
    mutationFn: async (leagueId: string) => {
      await apiRequest("DELETE", `/api/leagues/${leagueId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setSelectedLeagueId(null);
      toast({
        title: "Success",
        description: "League deleted successfully!",
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

  const handleCreateLeague = () => {
    if (!newLeagueName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a league name",
        variant: "destructive",
      });
      return;
    }
    createLeagueMutation.mutate({ name: newLeagueName });
  };

  const handleJoinLeague = () => {
    if (!joinCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a join code",
        variant: "destructive",
      });
      return;
    }
    joinLeagueMutation.mutate({ joinCode });
  };

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Copied!",
      description: "Join code copied to clipboard",
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  useEffect(() => {
    if (myLeagues && myLeagues.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId(myLeagues[0].id);
    }
  }, [myLeagues, selectedLeagueId]);

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-bold mb-2">No Squad Found</h2>
            <p className="text-muted-foreground mb-6">
              You need to build your squad before joining leagues.
            </p>
            <Button asChild data-testid="button-build-squad">
              <a href="/squad">Build Squad</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Leagues</h1>
          <p className="text-muted-foreground">
            Create or join leagues to compete with friends
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-league">
                <Plus className="h-4 w-4 mr-2" />
                Create League
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New League</DialogTitle>
                <DialogDescription>
                  Create a private league and invite your friends
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="league-name">League Name</Label>
                  <Input
                    id="league-name"
                    placeholder="Enter league name"
                    value={newLeagueName}
                    onChange={(e) => setNewLeagueName(e.target.value)}
                    data-testid="input-league-name"
                  />
                </div>
                <Button
                  onClick={handleCreateLeague}
                  disabled={createLeagueMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-create-league"
                >
                  {createLeagueMutation.isPending ? "Creating..." : "Create League"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-join-league">
                <LogIn className="h-4 w-4 mr-2" />
                Join League
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join League</DialogTitle>
                <DialogDescription>
                  Enter a league join code to participate
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="join-code">Join Code</Label>
                  <Input
                    id="join-code"
                    placeholder="Enter join code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    data-testid="input-join-code"
                  />
                </div>
                <Button
                  onClick={handleJoinLeague}
                  disabled={joinLeagueMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-join-league"
                >
                  {joinLeagueMutation.isPending ? "Joining..." : "Join League"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!myLeagues || myLeagues.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
              <Trophy className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Leagues Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first league or join an existing one to start competing!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>My Leagues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myLeagues.map((league) => (
                <div
                  key={league.id}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    selectedLeagueId === league.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover-elevate'
                  }`}
                  onClick={() => setSelectedLeagueId(league.id)}
                  data-testid={`league-${league.name.toLowerCase().replace(' ', '-')}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{league.name}</p>
                      <p className="text-xs opacity-80 font-mono">{league.joinCode}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyJoinCode(league.joinCode);
                        }}
                        className={selectedLeagueId === league.id ? 'hover:bg-primary-foreground/10' : ''}
                        data-testid={`button-copy-code-${league.id}`}
                      >
                        {copiedCode === league.joinCode ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      {league.createdBy === (user as any)?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to delete this league?")) {
                              deleteLeagueMutation.mutate(league.id);
                            }
                          }}
                          disabled={deleteLeagueMutation.isPending}
                          className={selectedLeagueId === league.id ? 'hover:bg-destructive/10' : 'hover:text-destructive'}
                          data-testid={`button-delete-league-${league.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {myLeagues.find(l => l.id === selectedLeagueId)?.name || 'Leaderboard'}
                </CardTitle>
                {currentGameweek && (
                  <Badge variant="outline" data-testid="badge-current-gameweek">
                    Gameweek {currentGameweek.number}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!leaderboard ? (
                <div className="text-center py-8">
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No teams in this league yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead className="w-12">Avatar</TableHead>
                      <TableHead>Team Name</TableHead>
                      <TableHead className="text-right">GW Points</TableHead>
                      <TableHead className="text-right">Total Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry) => (
                      <TableRow key={entry.rank} data-testid={`leaderboard-row-${entry.rank}`}>
                        <TableCell className="font-bold">
                          {entry.rank === 1 && (
                            <Trophy className="h-4 w-4 text-primary inline-block mr-1" />
                          )}
                          {entry.rank}
                        </TableCell>
                        <TableCell className="flex justify-center">
                          {entry.favoriteTeam && TEAM_LOGOS[entry.favoriteTeam] ? (
                            <img
                              src={TEAM_LOGOS[entry.favoriteTeam]}
                              alt={entry.favoriteTeam}
                              className="h-8 w-8 rounded-full object-cover"
                              data-testid={`team-logo-${entry.userId}`}
                            />
                          ) : entry.profileImageUrl ? (
                            <img
                              src={entry.profileImageUrl}
                              alt={entry.firstName}
                              className="h-8 w-8 rounded-full object-cover"
                              data-testid={`profile-image-${entry.userId}`}
                            />
                          ) : (
                            <div 
                              className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: entry.avatarBgColor || "#dbeafe",
                                color: entry.avatarPersonColor || "#3b82f6",
                              }}
                              data-testid={`avatar-${entry.userId}`}
                            >
                              <UserIcon className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="truncate">{entry.teamName}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                            {entry.firstName && (
                              <>
                                <span className="truncate">{entry.firstName}</span>
                                {entry.nationality && COUNTRY_FLAGS[entry.nationality] && (
                                  <span className="flex-shrink-0">{COUNTRY_FLAGS[entry.nationality]}</span>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {entry.gameweekPoints}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {entry.totalPoints}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
