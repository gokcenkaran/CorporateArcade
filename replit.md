# River Raid - Arcade Game

## Overview

This is a River Raid-style arcade game built with React, TypeScript, and Express. The game features a scrolling river environment where players control an aircraft, avoiding obstacles, shooting enemies, and managing fuel consumption. The application integrates with the aiNoodle MCP (Multi-Channel Protocol) SDK to enable parent-child webapp communication, allowing the game to be embedded and controlled by external applications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **React 18** with TypeScript for the UI layer
- **Vite** as the build tool and development server
- **Zustand** for state management with selector subscriptions
- **TailwindCSS** with custom theming for styling
- **Radix UI** components for accessible UI primitives
- **HTML5 Canvas** for game rendering

**Design Pattern:**
The frontend follows a component-based architecture with separation of concerns:

1. **Game Logic Layer** (`client/src/lib/stores/useRiverRaid.tsx`): Zustand store managing all game state including player position, enemies, bullets, score, lives, and fuel. This centralizes game logic and enables predictable state updates.

2. **Rendering Layer** (`client/src/components/game/RiverRaidGame.tsx`): Canvas-based game renderer using requestAnimationFrame for smooth 60fps gameplay. Handles collision detection, sprite rendering, and visual effects.

3. **UI Layer** (`client/src/components/game/GameUI.tsx`): Overlay UI displaying game stats (score, lives, fuel gauge) built with React components.

4. **MCP Integration Layer** (`client/src/lib/mcp/MCPCallee.ts`): Bidirectional communication protocol allowing parent webapps to control the game (start, pause, restart) and receive game state updates.

**State Management Rationale:**
Zustand was chosen over Redux for its simplicity and smaller bundle size. The `subscribeWithSelector` middleware enables granular subscriptions to specific state changes, optimizing re-renders for game performance.

### Backend Architecture

**Technology Stack:**
- **Express.js** for the HTTP server
- **Node.js** runtime environment
- **esbuild** for server bundling during production builds

**Design Pattern:**
The backend follows a minimalist REST API architecture:

1. **Server Entry Point** (`server/index.ts`): Configures Express middleware, logging, and routes HTTP server for potential WebSocket upgrades.

2. **Route Registration** (`server/routes.ts`): Centralized route definition with API prefix convention (`/api/*`).

3. **Static File Serving** (`server/static.ts`): Serves built frontend assets with SPA fallback to `index.html` for client-side routing.

4. **Storage Layer** (`server/storage.ts`): Abstract storage interface with in-memory implementation. Designed for easy swapping to database persistence.

**Architecture Decision:**
The backend is intentionally lightweight since this is primarily a client-side game. The storage interface provides a foundation for future features like user authentication, leaderboards, or game state persistence without requiring immediate database setup.

### Database Layer

**Technology Stack:**
- **Drizzle ORM** for type-safe database operations
- **PostgreSQL** dialect configuration (via Neon serverless driver)
- Schema-first approach with TypeScript type generation

**Design Pattern:**
Database schema is defined in `shared/schema.ts`, enabling type sharing between frontend and backend. The Drizzle configuration supports migrations in the `./migrations` directory.

**Current Schema:**
- `users` table with id, username, and password fields
- Zod validation schemas derived from Drizzle schema for runtime type safety

**Rationale:**
Drizzle was chosen for its zero-runtime overhead, excellent TypeScript integration, and SQL-like query builder. The shared schema pattern ensures type consistency across the full stack. While the database is configured, the application currently uses in-memory storage, making database provisioning optional during initial development.

### External Dependencies

**Third-Party Integrations:**

1. **Neon Serverless PostgreSQL** (`@neondatabase/serverless`):
   - Serverless-first database driver optimized for edge environments
   - WebSocket-based connection pooling for low latency
   - Configured via `DATABASE_URL` environment variable

2. **aiNoodle MCP SDK** (`@gokcenkaran/mcp-sdk`):
   - Private GitHub package for webapp-to-webapp communication
   - Supports layer, iframe, and standalone modes
   - Enables parent apps to control game lifecycle (play, pause, restart)
   - Provides query capabilities for pre-launch state inspection
   - Bidirectional message passing via postMessage API

3. **Radix UI Component Library**:
   - Extensive set of unstyled, accessible primitives
   - Accordion, Dialog, Dropdown, Select, Toast, and 20+ components
   - Used as foundation for custom-styled UI components

4. **Development Tools**:
   - `@replit/vite-plugin-runtime-error-modal`: Development error overlay
   - `vite-plugin-glsl`: GLSL shader support for potential 3D effects
   - PostCSS with Tailwind and Autoprefixer for CSS processing

**Asset Management:**
Custom Vite configuration includes support for 3D models (`.gltf`, `.glb`) and audio files (`.mp3`, `.ogg`, `.wav`), suggesting potential future enhancements with 3D graphics or sound effects.

**Build Strategy:**
Production builds use esbuild for server bundling with selective dependency bundling. Allowlisted dependencies (including database drivers, session stores, and external APIs) are bundled to reduce syscall overhead and improve cold start performance in serverless environments.