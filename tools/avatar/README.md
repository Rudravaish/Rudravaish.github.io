# Avatar creation tools

These are the Python tools used to customize the rigged avatar and prepare its web animation library. The exported GLBs are already included in `public/assets/`, so website development and CI do not require Blender.

## Inputs

Download the **Standard** versions of [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html), and extract them with this layout:

```text
asset-sources/
  base/Universal Base Characters[Standard]/
    Base Characters/Godot - UE/Superhero_Male_FullBody.gltf
    Base Characters/Textures/T_Superhero_Male_Dark.png
    Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_SimpleParted.gltf
    ...the pack's other companion files and textures
  animations/Universal Animation Library[Standard]/
    Unreal-Godot/UAL1_Standard.glb
```

Keep all companion files from the source packs. Alternatively, set `QUATERNIUS_ASSETS` to an absolute directory containing `base/` and `animations/`. The customized dark hair texture is included next to these scripts. The original portrait is not required or included; the scripts encode the small geometry adjustments.

## Build

Use Blender 5.x with glTF import/export support. From the repository root, with Blender on your PATH:

```sh
blender --background --python tools/avatar/build_avatar.py
python3 tools/avatar/trim_animations.py
npm run build
```

On macOS, use the Blender application's `Contents/MacOS/Blender` executable if `blender` is not on your PATH.

`build_avatar.py` starts a fresh Blender scene, imports the rigged human base, shapes the face, builds garments with interpolated bone weights, constructs rounded sneakers, customizes the hair, and adds a scalp underlayer. It saves the editable model and report under `build/avatar/` and replaces `public/assets/rudra-avatar.glb`.

`avatar_face_likeness.py` and `avatar_hair_likeness.py` hold the geometry adjustments. `trim_animations.py` retains the seven used animation clips and skeleton, dropping unused meshes and animation data, then replaces `public/assets/rudra-animations.glb`.

Rebuilding changes the exported model files. Run Blender in background mode as shown, because the script clears its scene before constructing the avatar. Source packs and intermediate Blender files are excluded from Git; their CC0 license permits use and modification.
