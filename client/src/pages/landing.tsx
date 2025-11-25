import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, Users, Target, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Landing() {
  const [mode, setMode] = useState<"view" | "login" | "signup">("view");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/login", { email, password });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "Logged in successfully" });
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
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signup", {
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Log In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
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
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Fantasy Mini League</h1>
              <p className="text-xs text-muted-foreground">5-a-side football</p>
            </div>
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => setMode("login")} data-testid="button-login-header">
              Log In
            </Button>
            <Button onClick={() => setMode("signup")} data-testid="button-signup-header">
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Build Your Dream 5-a-Side Team</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Pick your squad, manage transfers, and compete against friends in this Fantasy Premier League-style mini-game
          </p>
          <Button size="lg" onClick={() => setMode("signup")} data-testid="button-get-started">
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">5-a-side Squad</h3>
              <p className="text-sm text-muted-foreground">
                Pick 5 starters and 1 bench player within a 50M budget
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">Smart Scoring</h3>
              <p className="text-sm text-muted-foreground">
                Points for goals, assists, and MOTM. Position-based bonuses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">Power Chips</h3>
              <p className="text-sm text-muted-foreground">
                Bench Boost and Triple Captain to maximize your points
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">Create Leagues</h3>
              <p className="text-sm text-muted-foreground">
                Join or create leagues and compete on the leaderboard
              </p>
            </CardContent>
          </Card>
        </div>

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
