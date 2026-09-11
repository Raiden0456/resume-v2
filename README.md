# My résumé

A static résumé rendered from `resume.json`, plus a Three.js mountain rally game.

Run locally with `python3 -m http.server 8080`, then open `http://localhost:8080`.
The game lives at `rally.html`; the little car doing donuts on the résumé links to it.
Serve over HTTP rather than opening the HTML as a local file so the modules and résumé data can load.

Arrow keys or WASD drive, Space pulls the handbrake, E opens the nearby project,
M opens instant travel to any project, R returns to the summit start, and Escape pauses. On touch devices, turn to landscape:
drag on the left half to steer; hold the right half to accelerate, slide up to
drift, or slide down to brake and reverse. Turning at speed starts a slide naturally;
the handbrake widens it. Quick countersteering catches the rear, with grip returning
progressively and most of the cornering momentum retained. Sound is optional. Discovered places
are saved in local storage. The game needs WebGL 2.

The 840 × 980 map contains a roughly 2.5 km downhill course with a 300 metre descent.
Nine lookout stops run from the latest work, Rowte.io at the summit, to Highway
Logistic Group in the valley. Eight authored stages vary in width, length and
character: rocky ledges, hairpins, a narrow ridge, a quarry, a fast descent,
forest bends, a creek cut and an open valley. The Projects button or minimap
opens a destination list, available before starting and while driving. Numbered
map markers also jump directly to projects. FaceStellar is a beauty salon;
Supplier Success is a business accelerator.

A continuous mountain stream crosses the course five times: three bridges and
two ramps with open water between takeoff and landing. The riverbed, bridge decks
and ramps are separate surfaces. The car carries vertical momentum over crests
and cliffs, falls with short, heavy arcs and compresses its suspension on landing.
Small bumps are filtered over the wheelbase; climbing consumes speed and redirects
existing momentum upward, so steep banks cannot add free launch energy. Falling
into the stream returns the car to its last dry road position. Off-road driving
keeps almost all of the gravel pace, while static grip still holds a parked car
on slopes. The closer camera looks ahead along the direction of travel; labels
use crisp screen text independent of terrain texture resolution.

Project content comes from `resume.json`. The map's visual identities and
coordinates, road stages and rocky terrain are in `js/rally/world.js`; terrain rendering is in
`js/rally/terrain.js`, water and crossing meshes are in `js/rally/water.js`,
and car handling is in `js/rally/physics.js`.
No build step or package installation is needed. Three.js r180 is vendored in
`js/vendor/three/`, including its MIT license. Models, scenery, textures and audio
are generated locally; the résumé page does not load the 3D engine.

Run the physics, content coverage and persistence checks with:

```sh
node --test tests/rally.test.mjs
```
