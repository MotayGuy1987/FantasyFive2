import { db } from "./db";
import { players, users } from "@shared/schema";
import { eq } from "drizzle-orm";

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

    const adminEmail = "admin@admin.com";
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (!existingAdmin) {
      await db.insert(users).values({
        id: "admin-user-id",
        email: adminEmail,
        firstName: "Admin",
        lastName: "User",
        profileImageUrl: null,
      });
      console.log("Created admin user");
    }

    console.log("Database seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seedDatabase()
  .then(() => {
    console.log("Seed script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed script failed:", error);
    process.exit(1);
  });
