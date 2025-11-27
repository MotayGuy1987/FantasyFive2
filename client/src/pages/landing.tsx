import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, Users, Target, Zap, HelpCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Landing() {
  const [mode, setMode] = useState<"view" | "login" | "signup">("view");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [helpDialog, setHelpDialog] = useState<string | null>(null);
  const { toast } = useToast();

  const helpExplanations: Record<string, { title: string; description: string[] }> = {
    squad: {
      title: "5-a-Side Squad",
      description: [
        "Build your team with exactly 5 starting players and 1 bench player within a 50 million budget.",
        "You must maintain position balance: at least 1 defender, 1 midfielder, and 1 forward in your starting lineup.",
        "Your bench player acts as a backup - if a starter scores 0 points, your bench player automatically takes their place for that gameweek.",
      ],
    },
    scoring: {
      title: "Smart Scoring",
      description: [
        "Earn points based on real player performances each gameweek.",
        "Goals, assists, and Man of the Match awards all earn you points. Yellow and red cards deduct points.",
        "Position matters: Defenders earn 6 points per goal, while Midfielders and Forwards earn 5 points per goal.",
        "Your captain earns double points. With the Triple Captain chip, they earn triple points instead!",
      ],
    },
    chips: {
      title: "Power Chips",
      description: [
        "Bench Boost: Your bench player scores full points along with your starting 5. Instead of 5 players, you get 6 scoring for maximum advantage.",
        "Triple Captain: Make your captain score triple points instead of double. Perfect for when your captain is playing against a weak opponent.",
        "Each chip can only be used once every 7 gameweeks, so use them strategically!",
      ],
    },
    leagues: {
      title: "Create Leagues",
      description: [
        "Create private leagues and invite your friends using unique join codes.",
        "Compete on leaderboards to see who's the best fantasy manager.",
        "Join the Overall League automatically and compete against all players.",
        "Track your rank, total points, and gameweek performance against rivals.",
      ],
    },
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast({
        title: "Error",
        description: "Please enter a username or email",
        variant: "destructive",
      });
      return;
    }
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/login", { username, password });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "Logged in successfully" });
      window.location.href = "/";
    } catch (error: any) {
      const message = typeof error.message === "string" ? error.message : "Login failed";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    if (username.length < 3) {
      toast({
        title: "Error",
        description: "Username must be at least 3 characters",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signup", {
        username,
        email,
        password,
        firstName,
        lastName,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "Account created successfully" });
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (mode === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
        <Card className="w-full max-w-xs sm:max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Log In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="input-username"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                {loading ? "Logging in..." : "Log In"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setMode("signup")}
                data-testid="button-signup-switch"
              >
                Don't have an account? Sign Up
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("view")}
              >
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4 overflow-y-auto">
        <Card className="w-full max-w-xs sm:max-w-sm my-4">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Create Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-3 sm:space-y-4">
              <Input
                type="text"
                placeholder="Username (min 3 characters)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="input-username"
              />
              <Input
                type="text"
                placeholder="First Name (optional)"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-firstname"
              />
              <Input
                type="text"
                placeholder="Last Name (optional)"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-lastname"
              />
              <Input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
              <Input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
                {loading ? "Creating Account..." : "Sign Up"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setMode("login")}
                data-testid="button-login-switch"
              >
                Already have an account? Log In
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("view")}
              >
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-md bg-primary text-primary-foreground flex-shrink-0">
              <Trophy className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">Fantasy Mini League</h1>
              <p className="text-xs text-muted-foreground">5-a-side</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setMode("login")} size="sm" className="text-xs sm:text-sm" data-testid="button-login-header">
              Log In
            </Button>
            <Button onClick={() => setMode("signup")} size="sm" className="text-xs sm:text-sm" data-testid="button-signup-header">
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Build Your Dream 5-a-Side Team</h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8">
            Pick your squad, manage transfers, and compete against friends in this Fantasy Premier League-style mini-game
          </p>
          <Button onClick={() => setMode("signup")} className="text-xs sm:text-sm" data-testid="button-get-started">
            Get Started
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-12">
          <Card className="relative">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">5-a-side Squad</h3>
              <p className="text-sm text-muted-foreground">
                Pick 5 starters and 1 bench player within a 50M budget
              </p>
              <button
                onClick={() => setHelpDialog("squad")}
                className="absolute top-3 right-3 p-1 hover-elevate rounded-md"
                data-testid="button-help-squad"
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          <Card className="relative">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">Smart Scoring</h3>
              <p className="text-sm text-muted-foreground">
                Points for goals, assists, and MOTM. Position-based bonuses
              </p>
              <button
                onClick={() => setHelpDialog("scoring")}
                className="absolute top-3 right-3 p-1 hover-elevate rounded-md"
                data-testid="button-help-scoring"
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          <Card className="relative">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">Power Chips</h3>
              <p className="text-sm text-muted-foreground">
                Bench Boost and Triple Captain to maximize your points
              </p>
              <button
                onClick={() => setHelpDialog("chips")}
                className="absolute top-3 right-3 p-1 hover-elevate rounded-md"
                data-testid="button-help-chips"
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          <Card className="relative">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">Create Leagues</h3>
              <p className="text-sm text-muted-foreground">
                Join or create leagues and compete on the leaderboard
              </p>
              <button
                onClick={() => setHelpDialog("leagues")}
                className="absolute top-3 right-3 p-1 hover-elevate rounded-md"
                data-testid="button-help-leagues"
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Help Dialog */}
        {helpDialog && (
          <Dialog open={!!helpDialog} onOpenChange={() => setHelpDialog(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{helpExplanations[helpDialog]?.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {helpExplanations[helpDialog]?.description.map((desc, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">
                    {desc}
                  </p>
                ))}
              </div>
              <Button variant="outline" onClick={() => setHelpDialog(null)} className="w-full">
                Got it
              </Button>
            </DialogContent>
          </Dialog>
        )}

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">How It Works</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Build Your Squad</h4>
                    <p className="text-sm text-muted-foreground">
                      Select 5 starting players and 1 bench within your 50M budget
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Pick Your Captain</h4>
                    <p className="text-sm text-muted-foreground">
                      Your captain scores double points each gameweek
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Make Transfers</h4>
                    <p className="text-sm text-muted-foreground">
                      Get 1 free transfer per gameweek. Additional transfers cost -2 points
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Compete & Win</h4>
                    <p className="text-sm text-muted-foreground">
                      Join leagues and climb the leaderboard to prove you're the best manager
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Fantasy Mini League - A 5-a-side football management game</p>
        </div>
      </footer>
    </div>
  );
}
