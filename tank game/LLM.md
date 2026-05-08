# LLM.md

## Code File Paths
- `src/App.tsx`: Main application component
- `src/components/Core/Character.tsx`: 3D Character component
- `src/components/Package/World.tsx`: 3D World environment
- `src/components/Section/Scene.tsx`: Main 3D scene composition
- `src/components/Page/GamePage.tsx`: The main game page
- `src/components/App/GameApp.tsx`: The game application wrapper

## ELI10 TLDR LLM Instructions
- This project uses React Three Fiber (r3f) for 3D rendering.
- The character is controlled in 3rd person mode.
- The architecture follows Core -> Package -> Section -> Page -> App.
- Animations are handled via GSAP/Framer Motion or r3f's useFrame.
