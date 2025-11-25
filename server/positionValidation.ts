export const POSITIONS = {
  DEF: "DEF",
  MID: "MID",
  FWD: "FWD",
} as const;

export type Position = typeof POSITIONS[keyof typeof POSITIONS];

export interface SquadValidation {
  isValid: boolean;
  errors: string[];
  positionCounts: Record<Position, number>;
  lockedPlayerIds: string[];
}

export interface TransferValidation {
  canTransfer: boolean;
  reason?: string;
  isPositionLocked: boolean;
}

export interface PlayerWithPosition {
  id: string;
  position: string;
  isOnBench: boolean;
}

function getPositionCounts(
  players: PlayerWithPosition[]
): Record<Position, number> {
  return {
    [POSITIONS.DEF]: players.filter(
      p => p.position === POSITIONS.DEF && !p.isOnBench
    ).length,
    [POSITIONS.MID]: players.filter(
      p => p.position === POSITIONS.MID && !p.isOnBench
    ).length,
    [POSITIONS.FWD]: players.filter(
      p => p.position === POSITIONS.FWD && !p.isOnBench
    ).length,
  };
}

export function validateSquad(
  players: PlayerWithPosition[]
): SquadValidation {
  const starters = players.filter(p => !p.isOnBench);
  const positionCounts = getPositionCounts(players);
  const errors: string[] = [];
  const lockedPlayerIds: string[] = [];

  // Check if we have at least 1 DEF, 1 MID, 1 FWD
  if (positionCounts[POSITIONS.DEF] < 1) {
    errors.push("At least 1 Defender required in starters");
  }
  if (positionCounts[POSITIONS.MID] < 1) {
    errors.push("At least 1 Midfielder required in starters");
  }
  if (positionCounts[POSITIONS.FWD] < 1) {
    errors.push("At least 1 Forward required in starters");
  }

  // Mark single-position players as locked
  if (positionCounts[POSITIONS.DEF] === 1) {
    const defPlayer = starters.find(p => p.position === POSITIONS.DEF);
    if (defPlayer) lockedPlayerIds.push(defPlayer.id);
  }
  if (positionCounts[POSITIONS.MID] === 1) {
    const midPlayer = starters.find(p => p.position === POSITIONS.MID);
    if (midPlayer) lockedPlayerIds.push(midPlayer.id);
  }
  if (positionCounts[POSITIONS.FWD] === 1) {
    const fwdPlayer = starters.find(p => p.position === POSITIONS.FWD);
    if (fwdPlayer) lockedPlayerIds.push(fwdPlayer.id);
  }

  return {
    isValid: errors.length === 0,
    errors,
    positionCounts,
    lockedPlayerIds,
  };
}

export function validateTransfer(
  playerOutPosition: string,
  playerInPosition: string,
  teamPlayers: PlayerWithPosition[]
): TransferValidation {
  const validation = validateSquad(teamPlayers);
  const positionCounts = validation.positionCounts;

  // Count how many of each position are in starters
  const startersInOutPosition = teamPlayers.filter(
    p => p.position === playerOutPosition && !p.isOnBench
  ).length;

  // Check if player out is locked (only one of that position in starters)
  const isPlayerOutLocked = startersInOutPosition === 1;

  // If transferring to different position and player is locked
  if (
    playerOutPosition !== playerInPosition &&
    isPlayerOutLocked
  ) {
    return {
      canTransfer: false,
      reason: `Cannot transfer your only ${playerOutPosition}. You must have at least 1 ${playerOutPosition} in your starting XI.`,
      isPositionLocked: true,
    };
  }

  // If transferring to different position, check if it would break requirements
  if (playerOutPosition !== playerInPosition) {
    const newCounts = { ...positionCounts };
    newCounts[playerOutPosition as Position] -= 1;
    newCounts[playerInPosition as Position] += 1;

    if (
      newCounts[POSITIONS.DEF] < 1 ||
      newCounts[POSITIONS.MID] < 1 ||
      newCounts[POSITIONS.FWD] < 1
    ) {
      return {
        canTransfer: false,
        reason: "Transfer would violate squad position requirements",
        isPositionLocked: true,
      };
    }
  }

  return {
    canTransfer: true,
    isPositionLocked: false,
  };
}
