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
  { name: 'Tiklíng', note: 'a rufous ground bird (placeholder)', body: 0xD2703A, wing: 0xEFE6D2, size: 1.00, speed: 1.00 },
  { name: 'Maya',    note: 'a small city sparrow (placeholder)', body: 0x8C7A5B, wing: 0xC7B48C, size: 0.86, speed: 1.35 },
  { name: 'Kalaw',   note: 'a big-billed hornbill (placeholder)', body: 0x2E3A2A, wing: 0xEFE6D2, size: 1.24, speed: 0.72 },
  { name: 'Pipit',   note: 'a quick blue pipit (placeholder)',    body: 0x5D7FA0, wing: 0xBFD3E0, size: 0.80, speed: 1.55 },
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

// A flat, indexed triangle mesh from a raw vertex/face list. Cheap way to get
// an actual wing/tail *shape* without pulling in a glTF file and a loader.
function triMesh(verts, faces, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/**
 * A low-poly bird. Not a photoscan, but unmistakably a bird: an elongated
 * body, a head with a beak and two eyes, a softly forked tail, and two wings
 * that live on their own pivots so they can flap. The nose points along +x.
 *
 * Everything sits inside an inner group scaled by the variant size, so the
 * outer group's scale is free for the animation code to drive (companion vs
 * perched). Swap this whole function for a GLTFLoader load later if you want a
 * real model — the rest of the code only touches userData.{leftWing,rightWing}.
 */
export function buildBird(variantIndex) {
  const v = BIRD_VARIANTS[variantIndex % BIRD_VARIANTS.length];
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);

  const bodyMat = new THREE.MeshLambertMaterial({ color: v.body });
  const wingMat = new THREE.MeshLambertMaterial({ color: v.wing, side: THREE.DoubleSide });
  const beakMat = new THREE.MeshLambertMaterial({ color: 0xE8A13A });
  const eyeMat  = new THREE.MeshLambertMaterial({ color: 0x14100C });

  // body — an elongated blob down the x axis
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), bodyMat);
  body.scale.set(1.9, 0.98, 0.98);
  inner.add(body);

  // head, lifted toward the front
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), bodyMat);
  head.position.set(0.235, 0.065, 0);
  inner.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.12, 7), beakMat);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.345, 0.05, 0);
  inner.add(beak);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
    eye.position.set(0.275, 0.1, 0.052 * side);
    inner.add(eye);
  }

  // tail — swept back down -x, softly forked
  inner.add(triMesh(
    [-0.10, 0, 0,  -0.36, 0.006, 0.11,  -0.30, 0, 0,  -0.36, 0.006, -0.11],
    [0, 1, 2,  0, 2, 3],
    wingMat
  ));

  // wings — each on a shoulder pivot so rotation.x flaps them
  const rVerts = [0.09, 0, 0,  -0.11, 0, 0,  -0.10, 0, 0.30,  0.05, 0, 0.28,  -0.06, 0, 0.54];
  const rFaces = [0, 3, 1,  1, 3, 2,  3, 4, 2];
  const lVerts = rVerts.map((n, i) => (i % 3 === 2 ? -n : n));   // mirror across z

  const rightWing = new THREE.Group();
  rightWing.add(triMesh(rVerts, rFaces, wingMat));
  rightWing.position.set(0.02, 0.05, 0.05);

  const leftWing = new THREE.Group();
  leftWing.add(triMesh(lVerts, rFaces, wingMat));
  leftWing.position.set(0.02, 0.05, -0.05);

  inner.add(rightWing, leftWing);

  inner.scale.setScalar(v.size);
  g.userData = { variant: v, leftWing, rightWing, phase: variantIndex * 1.7 };
  return g;
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
