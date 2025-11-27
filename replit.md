# Fantasy Mini League

## Overview

Fantasy Mini League is a 5-a-side fantasy football mini-game inspired by Fantasy Premier League. Users build squads within a £50M budget, manage transfers, compete in leagues, and track gameweek performances. The application features squad building with position validation, transfer management with point penalties, league systems with leaderboards, and an admin panel for gameweek management and player performance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## Latest Changes (Nov 27, 2025)

**Profile Customization & Team Name Cooldown**
- Added avatar customization: users can now choose person color and background color from 8 color options
- Added nationality selection (190+ countries available)
- Added favorite soccer team selection (50+ major European teams)
- Implemented 7-day cooldown on team name edits - users can only change team name once per week
- Profile customization dialog opens when clicking on avatar in sidebar
- New schema fields in users table: `avatarPersonColor`, `avatarBgColor`, `nationality`, `favoriteTeam`, `lastTeamNameEditAt`
- New API endpoints: `PATCH /api/user/profile` and `GET /api/user/team-name-cooldown`
- New storage methods: `updateUserProfile()` and `canEditTeamName()` with 7-day calculation

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and dev server with HMR support
- **Wouter** for lightweight client-side routing instead of React Router

**UI Component System**
- **shadcn/ui** component library based on Radix UI primitives (New York style variant)
- **Tailwind CSS** for utility-first styling with custom design tokens
- Components follow a compound pattern with separate files for each UI element
- Custom CSS variables for theming (light/dark mode support via HSL color system)

**State Management**
- **TanStack Query (React Query)** for server state management and caching
- Query invalidation patterns for real-time data updates
- Custom hooks for authentication (`useAuth`) and common patterns
- Local component state with React hooks for UI-specific state

**Design System**
- Typography: Inter for UI, JetBrains Mono for numerical data
- Spacing based on Tailwind's scale (2, 4, 6, 8, 12 units)
- Position-based color coding (Defenders: blue, Midfielders: green, Forwards: orange)
- Consistent border radius (.5625rem for large, .375rem for medium)

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript running on Node.js
- Separate entry points for development (`index-dev.ts` with Vite middleware) and production (`index-prod.ts` with static file serving)
- Custom logging middleware for request/response tracking
- Session-based authentication with PostgreSQL session store

**Authentication System**
- Password-based authentication using PBKDF2 hashing (100,000 iterations, SHA256)
- Express-session with `connect-pg-simple` for persistent session storage
- Protected routes using `isAuthenticated` middleware
- Admin role detection based on email (`admin@admin.com`)
- Username-based login (email optional)

**Business Logic**
- Position validation system enforcing 5-a-side formation rules:
  - Minimum 1 of each position (DEF, MID, FWD) in starting lineup
  - 5 starters + 1 bench player
  - Position-locked transfers when removing a player would violate constraints
- Point calculation system with position-specific multipliers:
  - Defenders: 6pts/goal, 3pts/assist
  - Midfielders: 5pts/goal, 3pts/assist
  - Forwards: 5pts/goal, 3pts/assist
  - All positions: -1 yellow card, -2 red card, -3 straight red, +3 MOTM
  - Captain multiplier: 2x points
- Transfer system with free transfers per gameweek and -2 point penalties
- Chip system (Triple Captain, Bench Boost, Free Hit)
- Profile customization with cooldown timers

**API Design**
- RESTful endpoints organized by resource type (`/api/team`, `/api/players`, `/api/gameweeks`, etc.)
- Zod schemas for request validation
- Consistent error handling with HTTP status codes
- JSON response format throughout

### Data Storage

**Database**
- **PostgreSQL** via Neon serverless with connection pooling
- **Drizzle ORM** for type-safe database queries and schema management
- Schema-first approach with TypeScript type generation

**Database Schema**
Core tables:
- `users` - User accounts with authentication credentials + profile fields (avatar colors, nationality, favorite team, last edit timestamp)
- `players` - Available players with pricing and form status
- `teams` - User teams with budget and total points
- `team_players` - Many-to-many relationship with captain/bench flags
- `gameweeks` - Weekly competition periods with active/finalized state
- `player_performances` - Match statistics (goals, assists, cards, MOTM)
- `transfers` - Transfer history with point penalties
- `leagues` - Private leagues with join codes
- `league_members` - League membership tracking
- `gameweek_scores` - Calculated points per user per gameweek
- `chips` - Chip usage tracking
- `sessions` - Express session storage

**Data Access Layer**
- Storage interface (`IStorage`) abstracting database operations
- Drizzle queries with type-safe joins and filters
- Transaction support for multi-step operations

### External Dependencies

**Third-Party Services**
- **Neon Database** - Serverless PostgreSQL hosting
- **Google Fonts CDN** - Inter and JetBrains Mono font families

**Key NPM Packages**
- `@neondatabase/serverless` - PostgreSQL driver with WebSocket support
- `drizzle-orm` & `drizzle-kit` - ORM and migration tooling
- `express-session` & `connect-pg-simple` - Session management
- `@tanstack/react-query` - Data fetching and caching
- `@radix-ui/*` - Headless UI component primitives
- `tailwindcss` - Utility CSS framework
- `zod` - Runtime type validation
- `wouter` - Lightweight routing
- `class-variance-authority` & `clsx` - Component variant styling

**Development Tools**
- `vite` - Development server and build tool
- `tsx` - TypeScript execution for development
- `esbuild` - Production bundling
- `@replit/vite-plugin-*` - Replit-specific development plugins

**Database Management**
- Environment variable `DATABASE_URL` required for connection
- Migration files stored in `./migrations` directory
- Schema defined in `shared/schema.ts` for client/server sharing

## Deployment & Database Status

**Production Deployment**
- App deployed to Railway at live URL using GitHub integration
- PostgreSQL database hosted on Neon (serverless)
- Direct Neon connection used (not pooled) for DDL operations

**Database Migration Status** ✓ COMPLETE
- 24 Players migrated from local development DB to Neon
- 6 Users migrated (including admin@admin.com)
- 1 Active Gameweek (Gameweek 1)
- 2 Teams with full squad selections (admin & Sohan)
- 12 Team Players (6 per team with captain flags)
- 1 Gameweek Score recorded
- 5 Player Performances with match statistics
- Schema includes new profile customization fields

**Critical Fixes Applied**
- Logout functionality: Backend uses `session.destroy()` with full page redirect via `window.location.href`
- Position validation: Enforces minimum 1 defender, 1 midfielder, 1 forward
- Transfer system: Position-locked transfers with -2 point penalties
- Point calculation: Position-specific multipliers with captain 2x bonus
- Authentication: Username-based login with optional email
- Profile customization: 7-day cooldown on team name edits

**Admin Credentials**
- Email: admin@admin.com
- Password: admin@123
- Admin features: Gameweek management, player performance input, score finalization
