import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PositionBadgeProps {
  position: string;
  className?: string;
}

export function PositionBadge({ position, className }: PositionBadgeProps) {
  const getPositionColor = (pos: string) => {
    switch (pos) {
      case "Defender":
        return "bg-chart-2 text-white";
      case "Midfielder":
        return "bg-chart-1 text-white";
      case "Forward":
        return "bg-chart-5 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPositionAbbr = (pos: string) => {
    switch (pos) {
      case "Defender":
        return "DEF";
      case "Midfielder":
        return "MID";
      case "Forward":
        return "FWD";
      default:
        return pos.substring(0, 3).toUpperCase();
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-mono text-xs font-medium",
        getPositionColor(position),
        className
      )}
    >
      {getPositionAbbr(position)}
    </Badge>
  );
}
