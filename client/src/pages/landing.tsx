import { Trophy, Users, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
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
          <Button asChild data-testid="button-login">
            <a href="/api/login">Log In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Build Your Dream 5-a-Side Team</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Pick your squad, manage transfers, and compete against friends in this Fantasy Premier League-style mini-game
          </p>
          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login">Get Started</a>
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
