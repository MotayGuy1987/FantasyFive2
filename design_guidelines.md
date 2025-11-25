# Fantasy Premier League Mini-Game Design Guidelines

## Design Approach

**Reference + System Hybrid**: Drawing from Fantasy Premier League's proven UI patterns combined with modern dashboard design principles for data-heavy sports applications. The interface prioritizes quick decision-making, clear data hierarchy, and stat comprehension.

## Core Design Elements

### Typography
- **Primary Font**: Inter or Roboto via Google Fonts CDN
- **Headings**: Bold (700), sizes from text-3xl (dashboard headers) to text-lg (section titles)
- **Body Text**: Medium (500) for stats/numbers, Regular (400) for descriptions
- **Tabular Data**: Mono font (JetBrains Mono) for price tags, points, and numerical columns

### Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, 8, and 12
- Cards/containers: p-6
- Section spacing: space-y-8
- Tight groupings: gap-2
- Standard gaps: gap-4

### Component Library

**Navigation**
- Sticky top bar with logo, gameweek selector, and user menu
- Side navigation for main sections: Squad, Transfers, Leagues, Points (admin: + Admin Panel)
- Mobile: Hamburger menu with slide-out drawer

**Squad Builder Interface**
- Pitch visualization: 5-a-side formation grid with player cards positioned in formation (2 defenders, 2 midfielders, 1 forward typical layout)
- Player cards: Name, position badge, price, form star indicator
- Bench area below pitch with single slot
- Captain armband indicator (C) on selected player
- Budget tracker: Persistent display showing remaining funds (XX.XM / 50.0M)

**Player Selection Panel**
- Filterable player list: tabs for All/Defenders/Midfielders/Forwards
- Sort options: Price, Form, Points
- Each row: Player name, position badge, price, add/remove button
- Visual distinction for selected players

**Transfer Interface**
- Two-column layout: Current Squad | Available Players
- Transfer counter: "X Free Transfers (-2 per additional)"
- Swap mechanism: Click to remove, click to add with budget validation
- Confirm transfers button with point penalty warning

**Gameweek Dashboard**
- Hero section: Large gameweek number, total points, rank
- Points breakdown table: Player name, position, captain indicator, events (goals/assists/cards), points
- Chip activation buttons: Prominent "Bench Boost" and "Triple Captain" cards with availability status (Available / Used / Next Available: GW X)

**League System**
- League creation form: League name, generate code display
- Join league: Code input field
- Leaderboard table: Rank, Team Name, GW Points, Total Points
- Multi-column table with sticky header

**Admin Panel**
- Gameweek selector dropdown
- Player performance entry grid: Player rows with input fields for goals, assists, yellow cards, red cards, MOTM checkbox
- Bulk submit button

### Data Visualization
- Points progress: Simple bar indicators for each player's contribution
- Form indicators: Star icon (★) for high performers
- Status badges: Captain (C), Bench (B), chip active states
- Position badges: Color-coded pills (Defender/Midfielder/Forward)

### Interactive Elements
- Player cards: Hover state reveals detailed stats overlay
- Drag-and-drop: Optional for pitch formation adjustments
- Chip cards: Disabled state when unavailable with countdown text
- Transfer validation: Real-time budget updates and error states

### Responsive Breakpoints
- Desktop (1024px+): Side-by-side layouts, full pitch view
- Tablet (768px): Stacked sections, condensed pitch
- Mobile: Single column, simplified player cards, bottom navigation

### Form Patterns
- Text inputs: Full-width with clear labels above
- Dropdowns: Native select with custom arrow
- Buttons: Primary (filled), Secondary (outlined), Destructive (for transfers with penalties)
- Validation: Inline error messages below fields

## Images
No hero images for this application. This is a data-focused dashboard where screen real estate is precious. All visual interest comes from:
- Player avatars (circular, 40px x 40px)
- Position badge icons (from icon library)
- Formation pitch background (subtle gradient or field pattern)
- League/trophy icons for achievements

## Accessibility
- ARIA labels for all interactive pitch elements
- Keyboard navigation for player selection
- Focus states on all clickable cards
- Screen reader announcements for budget/point changes
- High contrast text on all data tables

## Animation Strategy
Minimal, performance-focused:
- Smooth transitions on budget counter updates (0.2s)
- Gentle scale on player card hover (scale-105)
- Slide transitions for mobile navigation
- Success confirmation animation on transfer submission