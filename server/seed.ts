import crypto from "crypto";
import { db } from "./db";
import { players, users } from "@shared/schema";
import { eq } from "drizzle-orm";

function hashPassword(password: string): string {
  const iterations = 100000;
  const keylen = 64;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

const PLAYERS_DATA = [
  { name: "Sohan", position: "Midfielder", price: "12.5" },
  { name: "Aarav", position: "Midfielder", price: "12.0" },
  { name: "Tyler", position: "Defender", price: "11.5" },
  { name: "Lawrence", position: "Midfielder", price: "11.5" },
  { name: "Lasik", position: "Forward", price: "10.5" },
  { name: "Alex", position: "Forward", price: "10.5" },
  { name: "Adam", position: "Forward", price: "9.5" },
  { name: "Dominick", position: "Defender", price: "9.0" },
  { name: "Harry", position: "Forward", price: "8.0" },
  { name: "Chase", position: "Midfielder", price: "8.0" },
  { name: "Dustin", position: "Midfielder", price: "7.5" },
  { name: "Ava", position: "Midfielder", price: "7.5" },
  { name: "Matthew", position: "Midfielder", price: "7.5" },
  { name: "Nicholas", position: "Midfielder", price: "7.0" },
  { name: "Carsen", position: "Forward", price: "7.0" },
  { name: "Jackson", position: "Forward", price: "7.0" },
  { name: "Alfred", position: "Midfielder", price: "6.5" },
  { name: "Elliott", position: "Defender", price: "6.5" },
  { name: "Maya", position: "Defender", price: "6.5" },
  { name: "Christian", position: "Defender", price: "5.5" },
  { name: "Declan", position: "Defender", price: "5.5" },
  { name: "Brody", position: "Defender", price: "5.5" },
  { name: "Dean", position: "Forward", price: "5.0" },
  { name: "Mason", position: "Defender", price: "4.5" },
];

export async function seedDatabase() {
  console.log("Starting database seed...");

  try {
    // Seed players
    for (const playerData of PLAYERS_DATA) {
      const existing = await db
        .select()
        .from(players)
        .where(eq(players.name, playerData.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(players).values({
          name: playerData.name,
          position: playerData.position,
          price: playerData.price,
          isInForm: false,
        });
        console.log(`Created player: ${playerData.name}`);
      }
    }

    // Seed admin user
    const adminEmail = "admin@fantasyfive.app";
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (!existingAdmin) {
      await db.insert(users).values({
        id: "admin-user-id",
        email: adminEmail,
        username: "admin",
        password: hashPassword("admin1"),
        firstName: "Admin",
        lastName: "User",
        profileImageUrl: null,
      });
      console.log("Created admin user");
    } else if (!existingAdmin.password || !existingAdmin.username) {
      // Update existing admin user with password and username
      await db.update(users)
        .set({ 
          password: hashPassword("admin1"),
          username: "admin"
        })
        .where(eq(users.email, adminEmail));
      console.log("Updated admin user with password and username");
    }

    console.log("Database seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Only run if called directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("Seed script finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed script failed:", error);
      process.exit(1);
    });
}
