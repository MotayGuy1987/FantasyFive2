import { sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  teamName: varchar("team_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  position: varchar("position").notNull(),
  price: decimal("price", { precision: 4, scale: 1 }).notNull(),
  isInForm: boolean("is_in_form").default(false),
});

export const gameweeks = pgTable("gameweeks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull().unique(),
  isActive: boolean("is_active").default(false),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  freeTransfers: integer("free_transfers").default(1),
  totalPoints: integer("total_points").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.userId),
]);

export const teamPlayers = pgTable("team_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: 'cascade' }),
  isCaptain: boolean("is_captain").default(false),
  isOnBench: boolean("is_on_bench").default(false),
  position: integer("position").notNull(),
}, (table) => [
  unique().on(table.teamId, table.playerId),
]);

export const playerPerformances = pgTable("player_performances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: 'cascade' }),
  gameweekId: varchar("gameweek_id").notNull().references(() => gameweeks.id, { onDelete: 'cascade' }),
  goals: integer("goals").default(0),
  assists: integer("assists").default(0),
  yellowCards: integer("yellow_cards").default(0),
  redCards: integer("red_cards").default(0),
  straightRed: boolean("straight_red").default(false),
  isMotm: boolean("is_motm").default(false),
  points: integer("points").default(0),
}, (table) => [
  unique().on(table.playerId, table.gameweekId),
]);

export const chips = pgTable("chips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  chipType: varchar("chip_type").notNull(),
  gameweekId: varchar("gameweek_id").notNull().references(() => gameweeks.id, { onDelete: 'cascade' }),
  usedAt: timestamp("used_at").defaultNow(),
}, (table) => [
  unique().on(table.teamId, table.chipType, table.gameweekId),
]);

export const transfers = pgTable("transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  gameweekId: varchar("gameweek_id").notNull().references(() => gameweeks.id, { onDelete: 'cascade' }),
  playerInId: varchar("player_in_id").notNull().references(() => players.id),
  playerOutId: varchar("player_out_id").notNull().references(() => players.id),
  cost: integer("cost").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leagues = pgTable("leagues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  joinCode: varchar("join_code").notNull().unique(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leagueMembers = pgTable("league_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  unique().on(table.leagueId, table.teamId),
]);

export const gameweekScores = pgTable("gameweek_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  gameweekId: varchar("gameweek_id").notNull().references(() => gameweeks.id, { onDelete: 'cascade' }),
  points: integer("points").default(0),
  benchBoostUsed: boolean("bench_boost_used").default(false),
  tripleCaptainUsed: boolean("triple_captain_used").default(false),
}, (table) => [
  unique().on(table.teamId, table.gameweekId),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertPlayer = typeof players.$inferInsert;
export type Player = typeof players.$inferSelect;

export type InsertGameweek = typeof gameweeks.$inferInsert;
export type Gameweek = typeof gameweeks.$inferSelect;

export type InsertTeam = typeof teams.$inferInsert;
export type Team = typeof teams.$inferSelect;

export type InsertTeamPlayer = typeof teamPlayers.$inferInsert;
export type TeamPlayer = typeof teamPlayers.$inferSelect;

export type InsertPlayerPerformance = typeof playerPerformances.$inferInsert;
export type PlayerPerformance = typeof playerPerformances.$inferSelect;

export type InsertChip = typeof chips.$inferInsert;
export type Chip = typeof chips.$inferSelect;

export type InsertTransfer = typeof transfers.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;

export type InsertLeague = typeof leagues.$inferInsert;
export type League = typeof leagues.$inferSelect;

export type InsertLeagueMember = typeof leagueMembers.$inferInsert;
export type LeagueMember = typeof leagueMembers.$inferSelect;

export type InsertGameweekScore = typeof gameweekScores.$inferInsert;
export type GameweekScore = typeof gameweekScores.$inferSelect;

export const insertTeamPlayerSchema = createInsertSchema(teamPlayers).omit({
  id: true,
});

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  createdAt: true,
});

export const insertLeagueSchema = createInsertSchema(leagues).omit({
  id: true,
  joinCode: true,
  createdAt: true,
});

export const insertPlayerPerformanceSchema = createInsertSchema(playerPerformances).omit({
  id: true,
  points: true,
});
