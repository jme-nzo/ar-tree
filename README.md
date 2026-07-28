# Growing tree — AR prototype

A browser AR artwork. A shared tree that grows a little with every scan, an
envelope on a branch holding a letter, and a bird that follows you for 24
hours once you have read it.

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

## The two modes

**Free mode** (`free.html`) needs nothing printed. The tree stands about two
metres in front of you and you move the phone to look around it. Start here,
because it works the second the page loads and it lets you judge the tree,
the letter, and the bird without fighting tracking.

**Marker mode** (`ar.html`) is the real mechanic: the tree grows out of a
printed image. It ships pointed at MindAR's sample target so you can test
immediately. Open [the target image][target] on a laptop and point your phone
at the screen.

[target]: https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png

### Using your own QR code as the target

1. Generate the QR code, at least 1000px, on a plain background.
2. Upload it to the [MindAR compiler][compile] and download `targets.mind`.
3. Put that file in this folder and change `TARGET_SRC` near the top of the
   module script in `ar.html` to `'targets.mind'`.

[compile]: https://hiukim.github.io/mind-ar-js-doc/tools/compile

One warning that will save you a day: plain QR codes track badly. Image
tracking wants many distinct feature points, and a QR is large repeating
blocks of pure black and white. The compiler will show you a feature map, and
a bare QR usually scores poorly. The fix is to design the printed mark so the
QR sits inside a richer illustrated plate, texture, botanical drawing, hand
lettering. That gives the tracker something to hold. Test this early.

## The growth slider

Tap the scan counter in the top left of either mode. A slider appears. Drag it
from 0 to 400 and watch every stage of the tree. This is the tool for
answering the question you have not answered yet: what should the tree look
like after a thousand people have scanned it?

`?growth=250` in the URL does the same thing without touching stored state,
which is useful for showing collaborators a specific stage.

## What is real and what is faked

| Piece | Status |
|---|---|
| Cross-platform camera AR | Real |
| Image tracking | Real, MindAR |
| Procedural tree driven by one number | Real, deterministic and seeded |
| Envelope, letter, fold interaction | Real |
| Four bird variants, 24 hour expiry | Real |
| **Shared growth across visitors** | **Faked.** Local to your phone |

The last row is the only faked one, and it is deliberate. See below.

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

**Netlify** changed. It moved to a credit model in late 2025 and the free
plan is now a shared pool of credits rather than a flat bandwidth allowance,
which works out to a good deal less headroom than it used to have. It is a
hard cap: exceed it and the site goes offline until the next month, with no
grace period. For a portfolio page that is fine. For a QR code on a gallery
wall during an opening, being offline until the first of the month is a
serious failure mode. Check the current numbers before you commit.

**Cloudflare Pages** is worth a look for the exhibition build specifically,
because bandwidth is unmetered on the free plan. For a piece whose whole
premise is that a lot of strangers scan it, that is the property you want.

None of this affects the code. All three serve the same static files.

## Files

```
index.html      landing, links to both modes
free.html       markerless mode, camera plus gyro
ar.html         marker mode, MindAR image tracking
js/scene.js     the artwork: tree, envelope, birds
js/growth.js    the growth curve and the two swap points
js/ui.js        letters, HUD, overlay, dev panel
css/style.css   all styling
```

## Known rough edges

- The bird orbits on a fixed lissajous path. It does not perch, land, or
  react. That is the next thing worth building, and it is where the piece
  either becomes alive or stays a demo.
- The letter is chosen by `scans % 4`, so it is effectively arbitrary. You
  have not decided who writes these yet.
- Free mode has no plane detection, so the tree floats at a fixed height
  rather than sitting on the actual floor.
- Gyro drift accumulates in free mode over a few minutes. Reload resets it.

## Licences

MindAR is MIT. Three.js is MIT. Both load from CDN, nothing is vendored here.
