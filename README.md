# The Reditus Campaign — Live Browser Overlay

A single web page draws every stream screen. The background, gold frames, nameplates, logos and the scrolling title bar are all live code. The camera windows are see-through holes.

## Screens (one Browser Source per OBS scene)

| OBS scene | URL ending |
|---|---|
| Main party | `index.html?scene=main` |
| Player spotlight | `index.html?scene=spotlight&focus=darius` (swap the name: elion, trey, lapadis, felix, jak…) |
| Battle map | `index.html?scene=map` |
| GM screen | `index.html?scene=gm` |
| Intro / starting soon | `index.html?scene=intro` |
| Short break | `index.html?scene=break` (a 3D collage of campaign art; one photo at a time is plucked out, floats up front with its name, then goes back) |

## For the DM: OBS setup (once)

1. **Add → Browser**. Paste the hosted URL. For testing from a folder, leave *Local file* unticked and paste `file:///F:/path/to/Browser Overlay 2026/index.html?scene=main`. The *Local file* checkbox drops the `?scene=` part.
2. Set **Width 1920, Height 1080**. Tick **Shutdown source when not visible**. Leave **Custom CSS** empty, or clear the default if it's there.
3. Put the Browser Source at the **top** of the source list. Put the cameras **underneath** it.
4. Add `&guides=1` to the URL. Each window now shows a labelled cyan box with its exact X / Y / size. Right-click each camera → **Edit Transform** and type those numbers in. Oversizing a camera slightly is fine because the overlay hides anything outside the window.
5. On the battle map screen, put the **GM camera above the map** source. Both go under the overlay.
6. Remove `&guides=1` when everything is lined up.

## For Cory: making changes

**Easiest: the control panel** at `https://nerdagenda.github.io/reditus-overlay/control.html`. Edit the party, stats, scrolling-bar messages, episode number and break settings, and watch them in the live preview. Press **Publish to stream** to save them; the stream picks them up about a minute later. The first time you publish it asks for a GitHub key, and the steps are shown right there.

You can also edit the files by hand:

- **Week to week:** edit `data.js` only. You can change the episode number, levels, AC/HP/stats, CTA messages, who's seated, and who's on camera or shown as art. Every open overlay updates within about 4 seconds, with no reload and no OBS refresh.
- **Player absent or off-cam:** set their `mode: "art"`. Their window is covered with their character art, and the DM doesn't touch anything.
- **Player added or removed:** add or remove them in `party` (or set `seat: false`). Layouts re-flow automatically. Tell the DM to check `&guides=1` because positions change.
- **Scrolling bar timing:** like the old overlay, it shows every character card (36s each), then two messages (40s each), then repeats. The whole card whips off to the right and the next one whips in from the left. All of the timings are in `ticker` in `data.js`.
- **Break-screen art:** every image from the Discord `#encounters` channel lives in `assets/break/discord/`. Their names and captions are in `break-images.js`, where you can fix a name, add a caption, or delete a line to drop an image. The collage shows 18 at a time and fades to a fresh random set every 6 plucks. Those settings are under `breakScreen` in `data.js`.
- **Code / design changes:** bump `build` in `data.js`. Every overlay then does a full reload by itself.

## Font

The original artwork uses **Thailandesa**. Drop `Thailandesa.ttf` into the `fonts/` folder and it's used automatically, on every PC, with no install needed. Until then the overlay falls back to *Germania One*, set in capitals to stay close to the original look.

## Testing in a normal browser

Add `&preview=1` to fill the windows with character art so you can see the whole look without cameras.
