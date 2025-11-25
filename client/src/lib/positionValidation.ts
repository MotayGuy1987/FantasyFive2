import type { Player } from "@shared/schema";

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
  lockedPlayers: Set<string>;
}

export interface TransferValidation {
  canTransfer: boolean;
  reason?: string;
  isPositionLocked: boolean;
}

export function getPositionCounts(players: Player[]): Record<Position, number> {
  return {
    [POSITIONS.DEF]: players.filter(p => p.position === POSITIONS.DEF).length,
    [POSITIONS.MID]: players.filter(p => p.position === POSITIONS.MID).length,
    [POSITIONS.FWD]: players.filter(p => p.position === POSITIONS.FWD).length,
  };
}

export function getStartingPlayers(
  players: Player[],
  benchPlayerId: string | null
): Player[] {
  return players.filter(p => p.id !== benchPlayerId);
}

export function validateSquad(
  players: Player[],
  benchPlayerId: string | null
): SquadValidation {
  const starters = getStartingPlayers(players, benchPlayerId);
  const positionCounts = getPositionCounts(starters);
  const errors: string[] = [];
  const lockedPlayers = new Set<string>();

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
    if (defPlayer) lockedPlayers.add(defPlayer.id);
  }
  if (positionCounts[POSITIONS.MID] === 1) {
    const midPlayer = starters.find(p => p.position === POSITIONS.MID);
    if (midPlayer) lockedPlayers.add(midPlayer.id);
  }
  if (positionCounts[POSITIONS.FWD] === 1) {
    const fwdPlayer = starters.find(p => p.position === POSITIONS.FWD);
    if (fwdPlayer) lockedPlayers.add(fwdPlayer.id);
  }

  return {
    isValid: errors.length === 0,
    errors,
    positionCounts,
    lockedPlayers,
  };
}

export function validateTransfer(
  playerOut: Player,
  playerIn: Player,
  teamPlayers: Player[],
  benchPlayerId: string | null
): TransferValidation {
  const starters = getStartingPlayers(teamPlayers, benchPlayerId);
  const positionCounts = getPositionCounts(starters);

  // Check if player out is locked (only one of that position in starters)
  const isPlayerOutLocked =
    positionCounts[playerOut.position as Position] === 1 &&
    starters.some(p => p.position === playerOut.position);

  // If transferring to different position and player is locked
  if (
    playerOut.position !== playerIn.position &&
    isPlayerOutLocked
  ) {
    return {
      canTransfer: false,
      reason: `Cannot transfer your only ${playerOut.position}. You must have at least 1 ${playerOut.position} in your starting XI.`,
      isPositionLocked: true,
    };
  }

  // If transferring to different position, check if it would break requirements
  if (playerOut.position !== playerIn.position) {
    const newCounts = { ...positionCounts };
    newCounts[playerOut.position as Position] -= 1;
    newCounts[playerIn.position as Position] += 1;

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
