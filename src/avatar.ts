import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSET_PATH = `${import.meta.env.BASE_URL}assets/`;
const CLIPS = [
  'Idle_Loop',
  'Walk_Loop',
  'Sprint_Loop',
  'Jump_Start',
  'Jump_Loop',
  'Jump_Land',
  'Interact',
] as const;
type ClipName = (typeof CLIPS)[number];

/**
 * The library and the finished character share a bone hierarchy, but their
 * bind poses differ slightly. Rebase each local animation channel onto the
 * character's own rest transform so its clothes and face stay aligned.
 */
function retargetClip(clip: THREE.AnimationClip, source: THREE.Object3D, target: THREE.Object3D) {
  const sourceBones = new Map<string, THREE.Object3D>();
  const targetBones = new Map<string, THREE.Object3D>();
  source.traverse(node => sourceBones.set(node.name, node));
  target.traverse(node => targetBones.set(node.name, node));
  const quaternion = new THREE.Quaternion();
  const tracks: THREE.KeyframeTrack[] = [];

  for (const track of clip.tracks) {
    const separator = track.name.lastIndexOf('.');
    const boneName = track.name.slice(0, separator);
    const property = track.name.slice(separator + 1);
    const sourceBone = sourceBones.get(boneName);
    const targetBone = targetBones.get(boneName);
    if (!sourceBone || !targetBone) continue;

    const copy = track.clone();
    const values = copy.values;
    if (property === 'quaternion') {
      const correction = targetBone.quaternion.clone().multiply(sourceBone.quaternion.clone().invert());
      for (let i = 0; i < values.length; i += 4) {
        quaternion.fromArray(values, i).premultiply(correction).normalize().toArray(values, i);
      }
    } else if (property === 'position') {
      const offset = targetBone.position.clone().sub(sourceBone.position);
      for (let i = 0; i < values.length; i += 3) {
        values[i] += offset.x;
        values[i + 1] += offset.y;
        values[i + 2] += offset.z;
      }
      // Movement is controlled by main.ts. Keep animation root motion in place.
      if (boneName === 'root') {
        for (let i = 0; i < values.length; i += 3) {
          values[i] = targetBone.position.x;
          values[i + 2] = targetBone.position.z;
        }
      }
    } else if (property === 'scale') {
      const ratio = targetBone.scale.clone().divide(sourceBone.scale);
      for (let i = 0; i < values.length; i += 3) {
        values[i] *= ratio.x;
        values[i + 1] *= ratio.y;
        values[i + 2] *= ratio.z;
      }
    }
    tracks.push(copy);
  }

  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/** Local forward is -Z, as expected by the world movement and camera. */
export function createAvatar() {
  const root = new THREE.Group();
  root.name = 'Rudra avatar';
  const facing = new THREE.Group();
  facing.rotation.y = Math.PI; // The GLB's face points toward +Z.
  root.add(facing);

  let mixer: THREE.AnimationMixer | null = null;
  let actions: Record<ClipName, THREE.AnimationAction> | null = null;
  let current: ClipName | null = null;
  let airborneBefore = false;
  let jumpStartRemaining = 0;
  let landingRemaining = 0;
  let interactionRemaining = 0;

  function play(name: ClipName, fade = 0.18) {
    if (!actions || current === name) return;
    const next = actions[name];
    if (!next) return;
    if (current && actions[current]) actions[current].fadeOut(fade);
    next.reset().fadeIn(fade).play();
    current = name;
  }

  function update(_time: number, delta: number, moving: boolean, sprinting = false, airborne = false) {
    if (!mixer) return;
    const dt = Math.min(delta, 0.1);
    if (airborne) {
      if (!airborneBefore) {
        jumpStartRemaining = 0.25;
        landingRemaining = 0;
        interactionRemaining = 0;
        play('Jump_Start', 0.1);
      } else if (jumpStartRemaining > 0) {
        jumpStartRemaining -= dt;
        if (jumpStartRemaining <= 0) play('Jump_Loop', 0.12);
      } else {
        play('Jump_Loop');
      }
    } else if (airborneBefore) {
      jumpStartRemaining = 0;
      landingRemaining = 0.46;
      play('Jump_Land', 0.12);
    } else if (landingRemaining > 0) {
      landingRemaining -= dt;
      if (landingRemaining <= 0) play(moving ? (sprinting ? 'Sprint_Loop' : 'Walk_Loop') : 'Idle_Loop');
    } else if (interactionRemaining > 0 && !moving) {
      interactionRemaining -= dt;
      play('Interact');
      if (interactionRemaining <= 0) play('Idle_Loop');
    } else {
      interactionRemaining = 0;
      play(moving ? (sprinting ? 'Sprint_Loop' : 'Walk_Loop') : 'Idle_Loop');
    }
    airborneBefore = airborne;
    mixer.update(dt);
  }

  function interact() {
    interactionRemaining = 1.4;
    landingRemaining = 0;
    if (mixer) play('Interact', 0.14);
  }

  const loader = new GLTFLoader();
  const character = loader.loadAsync(`${ASSET_PATH}rudra-avatar.glb`).then(gltf => {
    const model = gltf.scene;
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = false;
      if (node instanceof THREE.SkinnedMesh) node.frustumCulled = false;
    });
    facing.add(model);
    return model;
  });

  Promise.all([character, loader.loadAsync(`${ASSET_PATH}rudra-animations.glb`)]).then(([model, library]) => {
    const animationMixer = new THREE.AnimationMixer(model);
    mixer = animationMixer;
    actions = Object.fromEntries(CLIPS.map(name => {
      const original = library.animations.find(clip => clip.name === name);
      if (!original) throw new Error(`Missing avatar animation: ${name}`);
      const action = animationMixer.clipAction(retargetClip(original, library.scene, model));
      if (name === 'Walk_Loop') action.timeScale = 1.28;
      if (name === 'Sprint_Loop') action.timeScale = 1.24;
      if (name === 'Jump_Start') action.timeScale = 4.6;
      if (name === 'Jump_Land') action.timeScale = 2.8;
      if (name === 'Interact') action.timeScale = 1.4;
      if (name === 'Jump_Start' || name === 'Jump_Land' || name === 'Interact') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      return [name, action];
    })) as Record<ClipName, THREE.AnimationAction>;
    play('Idle_Loop', 0);
  }).catch(error => console.error('Could not load character or animations', error));

  return { root, update, interact };
}
