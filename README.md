# ArcadeGPU: Air Combat

**ELI10 TLDR:** Fly your airplane, maneuver with your mouse and keyboard, and blast enemy aircraft with your guns while navigating a 3D sky battlefield.

A high-performance 3D Flight Simulator Game built with the **ArcadeGPU** engine. This project features real-time Jolt Physics, custom 3D procedural meshes, and a nostalgic arcade aesthetic.

## 🎮 How to Play

### Controls
*   **W / S** - Pitch
*   **A / D** - Roll
*   **Q / E** - Yaw
*   **SHIFT / CTRL** - Throttle (Speed up / Slow down)
*   **MOUSE** - Pitch / Roll via steering
*   **LEFT CLICK / SPACE** - Shoot primary weapon
*   **Virtual Joystick / Buttons** - On-screen controls for mobile players

## 📁 Directory Structure

```text
/
├── arcadegpu-code/          # Core Engine Library (ArcadeGPU)
│   ├── src/lib/             # Engine Source (gfx3, jolt, input, etc.)
│   └── public/              # Core Assets (WASMs, standard textures)
├── components/
│   ├── App/                 # Main Application Components
│   │   ├── game/            # Game Entities (Plane, Enemy, Environment, Explosion)
│   │   └── App.tsx          # Main Game Screen Logic & UI Overlay
│   ├── Core/                # UI Design System Components
│   └── Package/             # Complex UI Modules
```

## 🛠 Developer Handoff Guide

### Key Systems

1.  **Input Handling**: Centralized in `inputManager`. Actions are registered in `GameScreen.onEnter()`. Pointer event propagation is explicitly stopped for touch UI buttons to prevent unintended camera movement while shooting/flying.
2.  **Flight Physics**: Simulating roll, pitch, yaw, and throttle mapped into forward vectors via Jolt Physics with gravity disabled.
3.  **Entity Lifecycle**:
    -   `constructor()`: Setup physics bodies and procedural meshes.
    -   `update(ts)`: Handle flight logic, move physics bodies, and sync mesh positions.
    -   `draw()`: Submit meshes to the `gfx3MeshRenderer`.
4.  **Targeting & Recoil**: The planes use forward direction pointing vectors to shoot projectiles dynamically.

## ⚙️ Build and Run

1.  Ensure all dependencies are installed via `npm install`.
2.  Run the development server with `npm run dev`.
3.  Navigate to `localhost:3000` to play.
