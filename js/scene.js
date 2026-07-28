// scene.js
// Everything that is actually the artwork: the tree, the envelope, the birds.
// Deliberately independent of how the camera pose arrives, so the same code
// runs under MindAR image tracking and under the markerless gyro mode.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { growthT } from './growth.js';

/* ---------- deterministic randomness ----------
   The tree must look identical to every visitor at the same scan count.
   So no Math.random anywhere: everything is seeded. */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- materials ---------- */

const BARK = new THREE.MeshLambertMaterial({ color: 0x5A4632 });
const LEAF = new THREE.MeshLambertMaterial({
  color: 0x7FA34F, side: THREE.DoubleSide,
});
const PAPER = new THREE.MeshLambertMaterial({
  color: 0xEFE6D2, side: THREE.DoubleSide,
});

export const BIRD_VARIANTS = [
  { name: 'Tiklíng',  body: 0xD2703A, wing: 0xEFE6D2, size: 1.00, speed: 1.00 },
  { name: 'Maya',     body: 0x8C7A5B, wing: 0xC7B48C, size: 0.82, speed: 1.35 },
  { name: 'Kalaw',    body: 0x2E3A2A, wing: 0xEFE6D2, size: 1.28, speed: 0.72 },
  { name: 'Pipit',    body: 0x5D7FA0, wing: 0xBFD3E0, size: 0.74, speed: 1.55 },
];

/* ---------- tree ---------- */

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

// Returns a geometry already positioned in tree space. Every branch gets
// merged into one mesh at the end: 190 draw calls will not hold framerate
// on a phone that is also running camera tracking. One will.
function segmentGeo(a, b, rBottom, rTop) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(rTop, rBottom, len, 5, 1, true);
  geo.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(a, q, ONE));
  return geo;
}

/**
 * Build the tree for a given scan count.
 * Returns { group, tips, envelopeAnchor, height }
 */
export function buildTree(scans) {
  const t = growthT(scans);
  const rand = mulberry32(1337);

  const group = new THREE.Group();
  const tips = [];
  const parts = [];

  // Growth reads through three channels at once: height, depth, density.
  const maxDepth = Math.round(1 + t * 5);          // 1 .. 6
  const trunkLen = 0.16 + t * 0.46;
  const baseRad  = 0.010 + t * 0.026;
  const spread   = 0.42 + t * 0.30;

  function grow(from, dir, len, rad, depth) {
    const to = from.clone().addScaledVector(dir, len);
    parts.push(segmentGeo(from.clone(), to.clone(), rad, rad * 0.68));

    if (depth >= maxDepth || len < 0.03) {
      tips.push({ pos: to.clone(), dir: dir.clone(), depth });
      return;
    }

    // Two children per node keeps the mesh count sane on a phone.
    const kids = depth === 0 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      const yaw   = (i / kids) * Math.PI * 2 + rand() * 1.6 + depth * 0.9;
      const pitch = spread * (0.55 + rand() * 0.7);
      const nd = new THREE.Vector3(
        Math.sin(pitch) * Math.cos(yaw),
        Math.cos(pitch),
        Math.sin(pitch) * Math.sin(yaw)
      ).normalize();
      // Branches inherit some of the parent direction so it reads as a tree,
      // not a firework.
      nd.lerp(dir, 0.32).normalize();
      grow(to, nd, len * (0.70 + rand() * 0.12), rad * 0.66, depth + 1);
    }
  }

  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), trunkLen, baseRad, 0);

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  group.add(new THREE.Mesh(merged, BARK));

  // Leaves arrive only once the tree has some structure to hang them on.
  if (t > 0.14 && tips.length) {
    const perTip = Math.max(1, Math.round(t * 9));
    const total = tips.length * perTip;
    const leafGeo = new THREE.PlaneGeometry(0.030, 0.019);
    const leaves = new THREE.InstancedMesh(leafGeo, LEAF, total);
    const dummy = new THREE.Object3D();
    let i = 0;
    for (const tip of tips) {
      for (let k = 0; k < perTip; k++) {
        dummy.position.copy(tip.pos)
          .add(new THREE.Vector3(
            (rand() - 0.5) * 0.075,
            (rand() - 0.5) * 0.075,
            (rand() - 0.5) * 0.075
          ));
        dummy.rotation.set(rand() * 3.14, rand() * 3.14, rand() * 3.14);
        dummy.updateMatrix();
        leaves.setMatrixAt(i++, dummy.matrix);
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    group.add(leaves);
  }

  let height = 0;
  for (const tip of tips) height = Math.max(height, tip.pos.y);

  // Hang the envelope on a mid-height tip so it is always reachable by thumb.
  const sorted = [...tips].sort((a, b) => a.pos.y - b.pos.y);
  const envelopeAnchor = sorted.length
    ? sorted[Math.floor(sorted.length * 0.45)].pos.clone()
    : new THREE.Vector3(0, trunkLen, 0);

  return { group, tips, envelopeAnchor, height: Math.max(height, trunkLen) };
}

/* ---------- envelope ---------- */

export function buildEnvelope() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.052), PAPER);
  g.add(body);

  const flap = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute([
        -0.0375, 0.026, 0.001, 0.0375, 0.026, 0.001, 0, -0.004, 0.001,
      ], 3)),
    new THREE.MeshLambertMaterial({ color: 0xCFC3A6, side: THREE.DoubleSide })
  );
  flap.geometry.computeVertexNormals();
  g.add(flap);

  // A soft ring that breathes, so people know it is the thing to press.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.055, 0.062, 24),
    new THREE.MeshBasicMaterial({
      color: 0xEFE6D2, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    })
  );
  ring.position.z = -0.002;
  g.add(ring);
  g.userData.ring = ring;

  // Generous invisible hit area. Fingers are not raycasters.
  const hit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  );
  hit.userData.isEnvelope = true;
  g.add(hit);
  g.userData.hit = hit;

  return g;
}

/* ---------- birds ---------- */

export function buildBird(variantIndex) {
  const v = BIRD_VARIANTS[variantIndex % BIRD_VARIANTS.length];
  const s = v.size;
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: v.body });
  const wingMat = new THREE.MeshLambertMaterial({
    color: v.wing, side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 8, 6), bodyMat);
  body.scale.set(1.6, 0.85, 0.85);
  g.add(body);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.005 * s, 0.018 * s, 5), bodyMat);
  beak.rotation.z = -Math.PI / 2;
  beak.position.x = 0.030 * s;
  g.add(beak);

  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.030 * s, 0.016 * s), wingMat);
  tail.position.x = -0.030 * s;
  tail.rotation.x = Math.PI / 2;
  g.add(tail);

  const wingGeo = new THREE.PlaneGeometry(0.055 * s, 0.024 * s);
  wingGeo.translate(0, 0.027 * s, 0);

  const left = new THREE.Mesh(wingGeo, wingMat);
  left.rotation.z = Math.PI / 2;
  const right = new THREE.Mesh(wingGeo, wingMat);
  right.rotation.z = -Math.PI / 2;
  g.add(left, right);

  g.userData = { variant: v, left, right, phase: variantIndex * 1.7, s };
  return g;
}

/**
 * Fly the bird on a lissajous orbit. `mode` is 'orbit' (around the tree)
 * or 'near' (hovering in front of the viewer, the companion state).
 */
export function flyBird(bird, time, treeHeight, mode = 'orbit') {
  const u = bird.userData;
  const spd = u.variant.speed;
  const T = time * spd + u.phase;

  const r = mode === 'near' ? 0.10 : 0.14 + treeHeight * 0.30;
  const cy = mode === 'near' ? treeHeight * 0.55 : treeHeight * 0.72;

  const x = Math.cos(T * 0.75) * r;
  const z = Math.sin(T * 0.75) * r * 0.85;
  const y = cy + Math.sin(T * 1.35) * (mode === 'near' ? 0.020 : 0.055);

  const prev = bird.position.clone();
  bird.position.set(x, y, z);

  // Aim along travel using the parent's own axes. lookAt would work in world
  // space and go wrong the moment the tree sits under a rotated anchor.
  const hx = bird.position.x - prev.x;
  const hz = bird.position.z - prev.z;
  if (hx * hx + hz * hz > 1e-10) bird.rotation.y = Math.atan2(-hz, hx);

  // Wingbeat. Faster birds flap faster, which is most of what sells them.
  const flap = Math.sin(T * 9) * 0.75;
  u.left.rotation.z = Math.PI / 2 - flap;
  u.right.rotation.z = -Math.PI / 2 + flap;
}

/* ---------- lighting ---------- */

export function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4A5A3A, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(0.5, 1, 0.6);
  scene.add(key);
}

/* ---------- cleanup ----------
   The growth slider rebuilds the tree on every drag frame. Without this the
   GPU accumulates a few hundred dead geometries in about ten seconds. */

export function disposeTree(built) {
  if (!built) return;
  built.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
