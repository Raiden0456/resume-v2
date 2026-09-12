# My résumé

A static résumé rendered from `resume.json`, plus a Three.js mountain rally game.

Run locally with `python3 -m http.server 8080`, then open `http://localhost:8080`.
The game lives at `rally.html`; the little car doing donuts on the résumé links to it.
Serve over HTTP rather than opening the HTML as a local file so the modules and résumé data can load.

Arrow keys or WASD drive, Space pulls the handbrake, E opens the nearby project,
M opens instant travel to any project, R restarts at the latest checkpoint, and Escape pauses. On touch devices, turn to landscape:
drag on the left half to steer; hold the right half to accelerate, slide up to
drift, or slide down to brake and reverse. Even moderate turns at speed start a slide;
a short handbrake tap helps initiate it, and throttle sustains it after release.
Quick countersteering catches the rear, with grip returning
progressively and most of the cornering momentum retained. Sound is optional. Discovered places
are saved in local storage. The game needs WebGL 2.

Graphics default to Balanced: up to 60 FPS, a 2.1 megapixel rendering budget
and dynamic shadows refreshed 15 times a second. Open the driving guide with
Escape or the help button to pick Energy saver (30 FPS, no dynamic shadows) or
High detail (sharper shadows, larger pixel budget); the choice is saved on this device. Physics runs at the same fixed rate in every mode.
The intro is a still view. Rendering stops while a menu is open, the window is
unfocused, the tab is hidden, or the phone shows the rotation notice. Project
camera motion runs at up to 30 FPS; pausing it stops rendering after the camera
settles. Terrain tiles and scenery batches are culled outside the camera view.

Every lookout is a checkpoint, saved as you drive through its coloured marker.
Brake to a stop there: the camera moves closer and E becomes available. Press E
or tap Explore to open a scrollable side card while the camera slowly sways left
and right around the initial view. The card can be widened, and the camera motion
can be paused. E, Escape or Back
to the road closes the card; driving stays paused while reading. Reduced-motion
preferences use a still view. The checkpoint survives reloads; the footer button
and R restart there, with the summit as the fallback before the first lookout.

New run places the car in the summit circle before Rowte.io. The timer starts
as you cross the chequered start stripe downhill; Rowte is the first timed
checkpoint. Visit all nine projects in order, then cross the finish arch after
Highway to stop the clock and launch a short firework display. Each split shows your
elapsed time and the difference from your previous completed descent, saved on
this device. The Projects list keeps every split available for review. Reading,
help and other pauses stop the clock; checkpoint restarts and recoveries keep
the elapsed time. Instant travel, including jumping to Rowte, ends the attempt.
New run returns to the start circle and arms a fresh timer. Results from the
older Rowte-to-Highway route are kept separate from this longer course.

The 840 × 980 map contains a roughly 2.5 km downhill course with a 300 metre descent.
Nine lookout stops run from the latest work, Rowte.io at the summit, to Highway
Logistic Group in the valley. Eight authored stages vary in width, length and
character: rocky ledges, hairpins, a narrow ridge, a quarry, a fast descent,
forest bends, a creek cut and an open valley. The Projects button or minimap
opens a destination list, available before starting and while driving. Numbered
map markers also jump directly to projects. FaceStellar is a beauty salon;
Supplier Success is a business accelerator.

A continuous mountain stream crosses the course five times: three bridges and
two ramps with open water between takeoff and landing. Each bridge extends far
enough onto both banks for its full width to meet the road; rendering and physics
use the same deck boundaries. The riverbed, bridge decks
and ramps are separate surfaces. The car carries vertical momentum over crests
and cliffs, falls with short, heavy arcs and compresses its suspension on landing.
Small bumps are filtered over the wheelbase; climbing consumes speed and redirects
existing momentum upward, so steep banks cannot add free launch energy. Falling
into the stream produces droplets and foam rings before returning the car to its
last dry road position. Long falls away
from the course trigger a brief explosion and a return to the latest checkpoint;
real ramp launches have extra time and space to land safely. Top speed is about
104 km/h, with slightly firmer lateral grip to make slides easier to catch. Off-road driving
keeps almost all of the gravel pace, while static grip still holds a parked car
on slopes. The closer camera looks ahead along the direction of travel; labels
use crisp screen text independent of terrain texture resolution.
Explosion and splash sounds are synthesized locally and follow the Sound toggle.

The summit has a coffee stop, service canopy and parked rally cars. The finish
opens into a food court and a four-car parc fermé. Each project has its own small
props, from parcel lockers and bicycles to a demo stage and a beauty salon patio.
Flags, steam, rooftop fans and soft lights animate nearby; reduced-motion mode
keeps them still. The drive through both camps and all checkpoints stays clear.

Project content comes from `resume.json`. The map's visual identities and
coordinates, road stages and rocky terrain are in `js/rally/world.js`; terrain rendering is in
`js/rally/terrain.js`, water and crossing meshes are in `js/rally/water.js`,
car handling is in `js/rally/physics.js`, and lookout interactions and camera
transitions are in `js/rally/stops.js` and `js/rally/camera.js`.
Descent splits are in `js/rally/timing.js`; fall recovery and its visual effect
are in `js/rally/recovery.js` and `js/rally/effects.js`.
Camp scenery and animated project details are in `js/rally/atmosphere.js`.
The import map in `rally.html` gives all game modules one shared release version;
bump its version and the boot/CSS URLs together when publishing changes to avoid
mixing cached modules from different releases.
No build step or package installation is needed. Three.js r180 is vendored in
`js/vendor/three/`, including its MIT license. Models, scenery, textures and audio
are generated locally; the résumé page does not load the 3D engine.

Run the physics, content coverage and persistence checks with:

```sh
node --test tests/rally*.test.mjs
```
