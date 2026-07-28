# Growing tree — AR prototype

A browser AR artwork. One experience: you set a tree down in the room in front
of you, size it with a pinch, and lock it in place. A bird orbits the tree,
lands on top, and — the moment you look away — flies in front of your camera
and refuses to leave, following you wherever you go.

Runs in stock Safari on iPhone and Chrome on Android. No app, no WebXR, no
build step, no npm install. Every file here is static.

## Getting it on your phone in five minutes

Camera access requires HTTPS. You cannot open these files by double clicking
them; `file://` will not grant camera permission. That is what the hosting is
actually for.

1. Make a new **public** repo on GitHub and push this folder to it.
2. Repo → Settings → Pages → Source: *Deploy from a branch* → Branch: `main`,
   folder `/ (root)` → Save.
3. Wait about a minute. Your URL appears at the top of that same page, in the
   form `https://YOURNAME.github.io/REPONAME/`.
4. Open that URL on your phone.

That is the whole deployment. Every `git push` republishes.

## How it works, for a visitor

1. Tap **Allow camera and begin**. Grant camera and motion access.
2. The tree floats in front of you. Turn until it sits where you want it and
   **tap to place** it.
3. **Pinch** to resize. **Drag with two fingers** to slide it across the floor,
   nearer or farther. When it looks right, tap **Lock in place**.
4. Now just look around it. Look *away* and the bird leaves the tree to hover
   right in front of your lens. Look back and it returns to the tree, circles,
   and settles on the crown again.

The **Move tree** button (top right, after locking) drops you back into adjust
mode if you want to reposition or resize.

## About the tracking, honestly

iOS Safari has no WebXR and no in-browser plane detection or SLAM. So this does
not glue the tree to a physical floor spot the way a native ARKit app would —
if you walk across the room, the tree will not stay pinned to the same tile.
What it *does* do is anchor the tree by the phone's gyroscope: once placed, it
stays fixed in **direction** in space, so you can turn all the way around and
look at it from where you left it. For a handheld "stand here and look" piece
that reads as placed. The bird's follow behaviour works regardless of where you
walk, because it is anchored to the camera, not the room.

If you later want true floor-locked, walk-around AR on iPhone, that needs a
native path (ARKit / Reality Composer, or USDZ Quick Look) rather than a web
page.

## The growth slider

Tap the scan counter in the top left. A slider appears. Drag it from 0 to 400
and watch every stage of the tree. This is the tool for answering the question
you have not answered yet: what should the tree look like after a thousand
people have scanned it?

`?growth=250` in the URL does the same thing without touching stored state,
which is useful for showing collaborators a specific stage.

## What is real and what is faked

| Piece | Status |
|---|---|
| Markerless camera AR | Real |
| Gyro-anchored placement, pinch-scale, two-finger move | Real |
| Procedural tree driven by one number | Real, deterministic and seeded |
| Envelope, letter, fold interaction | Real |
| Bird: orbit → perch → follow-the-camera | Real |
| Four bird variants, 24 hour expiry | Real |
| **Shared growth across visitors** | **Faked.** Local to your phone |
| **Floor-locked walk-around tracking** | **Not attempted.** See tracking note above |

## Adding the real shared tree

Everything storage-related lives in `js/growth.js`, in two functions marked
`SWAP POINT`. Nothing else in the codebase touches storage. Replace those two
bodies and the tree becomes genuinely communal.

You do not need Supabase to start. The smallest honest version is a single
table with a single row:

```sql
create table tree (id int primary key default 1, scans int not null default 0);
insert into tree (id, scans) values (1, 0);
```

Supabase gives you that plus an HTTP endpoint without writing a server, which
is why it is worth the afternoon of learning. If you would rather not, any
tiny Node or Deno endpoint backed by a file works identically for a single
counter.

Whatever you use, rate limit it. One person refreshing forty times should not
advance the tree a whole stage.

## On hosting

**GitHub Pages** is the right answer for the prototype and probably for the
exhibition too. Free, HTTPS included, roughly 100GB of bandwidth per month,
and it is already where your code is. The catch is that the free tier requires
a public repo.

**Cloudflare Pages** is worth a look for the exhibition build specifically,
because bandwidth is unmetered on the free plan. For a piece whose whole
premise is that a lot of strangers scan it, that is the property you want.

None of this affects the code. Both serve the same static files.

## Files

```
index.html      the whole experience: place, scale, lock, look, bird
js/scene.js     the artwork: tree, envelope, bird meshes
js/growth.js    the growth curve and the two swap points
js/ui.js        letters, HUD, overlay, dev panel
css/style.css   all styling
```

## Known rough edges

- No plane detection, so the tree sits at a fixed eye-height offset rather than
  on the actual detected floor, and does not stay pinned if you walk.
- The letter is chosen by `scans % 4`, so it is effectively arbitrary. You
  have not decided who writes these yet.
- Gyro drift accumulates over a few minutes. Reload resets it.

## Licences

Three.js is MIT, loaded from CDN. Nothing is vendored here.
