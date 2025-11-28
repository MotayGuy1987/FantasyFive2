import crypto from "crypto";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

function hashPassword(password: string): string {
  const iterations = 100000;
  const keylen = 64;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, hash: string | null): boolean {
  if (!hash) return false;
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) return false;
  const iterations = 100000;
  const keylen = 64;
  const computedHash = crypto.pbkdf2Sync(password, salt, iterations, keylen, "sha256").toString("hex");
  return computedHash === storedHash;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  
  // Log session configuration for debugging
  const isProduction = process.env.NODE_ENV === "production";
  const hasRailwayEnv = !!process.env.RAILWAY_ENVIRONMENT_NAME;
  const secureFlag = isProduction || hasRailwayEnv;
  console.log(`[Session] NODE_ENV=${process.env.NODE_ENV}, RAILWAY=${hasRailwayEnv}, secure=${secureFlag}`);
  
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: secureFlag,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  if (!process.env.DATABASE_URL) {
    console.error("CRITICAL: DATABASE_URL environment variable is not set");
  }
  if (!process.env.SESSION_SECRET) {
    console.error("CRITICAL: SESSION_SECRET environment variable is not set");
  }
  app.use(getSession());

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username/email and password are required" });
      }

      // Check if input is an email or username
      let user;
      try {
        if (username.includes("@")) {
          console.log(`Login: Looking up user by email: ${username}`);
          user = await storage.getUserByEmail(username);
        } else {
          console.log(`Login: Looking up user by username: ${username}`);
          user = await storage.getUserByUsername(username);
        }
      } catch (dbError) {
        console.error("Database lookup error:", dbError);
        throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid username/email or password" });
      }

      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({ message: "Invalid username/email or password" });
      }

      (req.session as any).userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            reject(err);
          } else {
            console.log("Login successful, session saved");
            resolve();
          }
        });
      });

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error("Login error:", error);
      const errorMsg = error instanceof Error ? error.message : "Login failed";
      res.status(500).json({ message: `Login failed: ${errorMsg}` });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }

      try {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already taken" });
        }
      } catch (dbError) {
        console.error("Database check error:", dbError);
        throw new Error(`Database error during username check: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }

      const hashedPassword = hashPassword(password);
      let user;
      try {
        console.log(`Signup: Creating user with username: ${username}`);
        user = await storage.upsertUser({
          username,
          email: email || null,
          password: hashedPassword,
          firstName: firstName || "",
          lastName: lastName || "",
        });
        console.log(`Signup: User created successfully: ${user.id}`);
      } catch (dbError) {
        console.error("User creation error:", dbError);
        throw new Error(`Database error during user creation: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }

      (req.session as any).userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            reject(err);
          } else {
            console.log("Signup successful, session saved");
            resolve();
          }
        });
      });

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error("Signup error:", error);
      const errorMsg = error instanceof Error ? error.message : "Signup failed";
      res.status(500).json({ message: `Signup failed: ${errorMsg}` });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = user;
  next();
};
