# Rudra Vaishnav — Interactive Portfolio

[Explore the live world](https://rudravaish.github.io/)

A small, playable mountain overlook with six destinations: about me, experience, projects, skills, ongoing work, and life beyond code. Walk to a pedestal or select a destination to open its portfolio card.

## Technology and responsibilities

| Technology | What it does here |
| --- | --- |
| **TypeScript** | World construction, keyboard/touch input, movement, jumping, camera following, destination interactions, typed portfolio data, and animation control. |
| **Three.js / WebGL** | Renders the 3D scene, lights, shadows, materials, geometry, and rigged GLB avatar. |
| **CSS** | Responsive interface, panels, labels, controls, and transitions. |
| **HTML** | The accessible page structure and canvas that host the experience. |
| **Python / Blender** | Builds fitted clothes and sneakers, adjusts the avatar's face and hair, preserves skinning, and exports the model. |
| **Vite / GitHub Actions / Pages** | Compiles TypeScript to browser JavaScript, builds the website, and publishes it automatically. |

GitHub's language chart measures source bytes, not effort or feature count. The real TypeScript, Python, CSS, and HTML source is included. Generated bundles and the dependency lockfile are marked as generated in `.gitattributes`, following [GitHub Linguist's documented behavior](https://github.com/github-linguist/linguist/blob/main/docs/overrides.md). No files are relabeled to manufacture percentages.

## How it was made

1. **The world:** `src/main.ts` assembles the circular stone terrace, railing, trees, lanterns, and six pedestals with Three.js geometry. The floor uses a procedural canvas texture; the distant mountains use an AI-generated panorama on a backdrop plane.
2. **Movement and camera:** Keyboard and touch inputs produce a camera-relative direction. Movement uses elapsed time, normalizes diagonals, keeps the player within the terrace, and smoothly turns the avatar toward travel. Jumping uses vertical velocity and gravity. A following camera also supports full-character and face views.
3. **Interactions:** Each destination's position and content live in `src/content.ts`. Clicking a label walks the character there. Proximity reveals the interaction prompt, and the panel displays that destination's information. A destination list also works when WebGL is unavailable.
4. **The character:** A Quaternius rigged human base was customized in Blender with Python. Garment surfaces follow the body's geometry and skinning weights; the outfit is a fitted black shirt, light blue jeans, and white sneakers. Face and hair adjustments follow the supplied portrait, with a dark scalp underlayer covering gaps between hair locks.
5. **Animation:** `src/avatar.ts` loads the character and seven clips, rebases animation transforms onto the character's rest pose, removes horizontal root motion, and blends idle, walk, sprint, jump, landing, and interaction states.
6. **Publication:** GitHub Actions installs the locked dependencies, runs strict TypeScript checks, builds with Vite, and deploys `dist/` to GitHub Pages. The source stays readable in the repository.

## Project layout

```text
src/
  main.ts                 World, controls, camera, and UI interactions
  avatar.ts               Rig loading, retargeting, and animation states
  content.ts              Typed portfolio destinations and content
  style.css               Interface and responsive styling
public/
  assets/                 Avatar, animations, panorama, and résumé
tools/avatar/             Blender Python tools and rebuild instructions
.github/workflows/         Type-check, build, and Pages deployment
index.html                Page shell
```

## Run locally

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local address Vite prints. `npm run check` performs strict type checking. `npm run build` checks and creates the production website in `dist/`; `npm run preview` serves that build locally. Blender is only needed to rebuild the model, not to run or deploy the website.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Drag on the world | Look around |
| Shift | Run |
| Space | Jump |
| E | Open a nearby destination |
| M | Toggle the destination list |
| V | View the character / return to the world |
| F in character view | Toggle face detail |
| Escape | Close panels and return to the world |

Touch controls and clickable destinations are also available.

## Assets and credits

- Character base and source hairstyle: [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html).
- Source animation clips: [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html).
- These Quaternius assets are provided under **CC0 1.0**. The avatar has custom clothing, shoes, facial proportions, and hair adjustments; it is not an Epic Games or Fortnite asset.
- Mountain panorama: generated for this portfolio. Terrain and architectural geometry are constructed in code.
- Portfolio design and refinements were developed with Codex assistance. Personal content comes from Rudra's résumé and supplied details.
- The avatar is a stylized interpretation of a single portrait. It is not an exact facial scan.

See [`tools/avatar/README.md`](tools/avatar/README.md) for the model pipeline and its source pack requirements.
