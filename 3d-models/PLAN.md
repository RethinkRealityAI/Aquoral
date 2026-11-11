# Aquoral 3D models: generation plan

Status (2026-11-10, update): v1 delivered. aquoral-bottle.glb and aquoral-box.glb built procedurally (three.js, source/build.html) with redrawn pack artwork; Meshy image-to-3D run kept in meshy/ for comparison (garbled back text, not for use). Renders in renders/. Open: real mm dimensions, box dielines, Canadian bilingual label copy, cap-off pump photo.

## What we know about the product (from aquoralspray.com text)
- Aquoral Protective Oral Spray, retail box holds **2 canisters, 10 mL (0.338 fl oz) each**.
- Pocket-size pump spray bottles ("Shake gently", "Pump may require priming").
- Key site images (could not be downloaded from this environment; the site returns HTML to non-browser clients):
  - Box + bottles: /wp-content/uploads/2024/06/Aquoral-Product-1.webp (460x609)
  - Hero product: /wp-content/uploads/2023/06/home_hero_product_23061502.webp
  - Video poster: /wp-content/uploads/2023/04/video_poster_23062701.webp

## Inputs needed
1. Meshy API key, plus `api.meshy.ai` allowed in the cloud environment's network access (currently denied).
2. Reference photos (best: real product shot on plain white/grey, even light, no reflections):
   - Bottle: front, side (90°), back, and top/nozzle close-up. Cap on and cap off if possible.
   - Box: front, back, one side, top, and a 3/4 angle. Flat dielines/print PDFs are even better.
   - Real dimensions (mm) of bottle height/diameter and box W x H x D.

## Approach
- **Bottle:** Meshy multi-image-to-3D (front/side/back), PBR on, target ~30k tris, then clean-up in Blender:
  make it rotationally symmetric (lathe from the generated silhouette) so the silhouette is perfect for the hero's video-to-3D handoff, separate materials (bottle body, cap, nozzle, label), re-project the label as a sharp texture rather than relying on the AI texture.
- **Box:** Do not AI-generate. A box is a simple cuboid; build it in Blender/three.js at real dimensions and UV-map the actual print artwork onto each face. This gives crisp, legible text (AI image-to-3D blurs small type, which matters for regulated health packaging).
- **Export:** GLB with Draco/meshopt compression + KTX2 textures, target < 3 MB bottle, < 1 MB box, real-world scale in metres, origin at base centre, Y-up. Also USDZ later for iOS AR.
- **Deliverables:** `/mnt/project-files/3d-models/` with `aquoral-bottle.glb`, `aquoral-box.glb`, preview renders (front, 3/4, side silhouette PNG on transparency for the hero thread), and a viewer page.
