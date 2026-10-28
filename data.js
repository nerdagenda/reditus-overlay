/* ==========================================================================
   THE REDITUS CAMPAIGN — LIVE OVERLAY DATA
   --------------------------------------------------------------------------
   This is the ONLY file you need to edit week to week.
   Save it and every open overlay picks up the change within a few seconds.
   No re-rendering, no refreshing OBS.

   Tips:
   - Text goes between quotes: "like this". Keep the commas at line ends.
   - Lines starting with // are notes and are ignored.
   - Bump `build` only when the overlay CODE changes (forces a full reload).
   ========================================================================== */

window.REDITUS = {
  build: 1,

  /* ---------- Show info ---------- */
  show: {
    episode: 113,
    schedule: "Every Tuesday @ 8:00PM EST",
  },

  /* ---------- The Grand Master (DM) seat ---------- */
  gm: {
    label: "Grand Master",
    mode: "cam",          // "cam" = see-through for the webcam, "art" = show `art` image instead
    art: "",
  },

  /* ---------- The party ----------
     Order here = seat order on every screen (left→right, top→bottom).
     seat:    true  = gets a camera window.   false = no window (still can appear in the ticker)
     mode:    "cam" = see-through cutout for the webcam
              "art" = covers the window with the character's `art` (player is off-cam / absent)
     ticker:  true  = show this character's stat card in the scrolling bar
     stats:   STR DEX CON INT WIS CHA
     portrait: square image used on the stat card
     art:     image used when mode is "art" (defaults to portrait)
  */
  party: [
    { id: "trey",    name: "Trey",    fullName: "Tredecim Imago",     seat: true,  mode: "cam", ticker: true,
      level: 11, race: "Drow",          cls: "Fighter",   ac: 18, hp: 92,
      stats: { str: 13, dex: 17, con: 15, int: 8, wis: 12, cha: 11 },
      portrait: "assets/portraits/trey.jpg" },

    { id: "darius",  name: "Darius",  fullName: "Darius Silverstrum", seat: true,  mode: "cam", ticker: true,
      level: 11, race: "Half-Elf",      cls: "Bard",      ac: 18, hp: 70,   // TODO: still the old level 8 numbers — update from Darius's sheet
      stats: { str: 8, dex: 16, con: 16, int: 12, wis: 10, cha: 19 },
      portrait: "assets/portraits/darius.jpg" },

    { id: "lapadis", name: "Lapadis", fullName: "Lapadis",            seat: true,  mode: "cam", ticker: true,
      level: 10, race: "Satyr",         cls: "Barbarian", ac: 19, hp: 95,
      stats: { str: 21, dex: 20, con: 15, int: 10, wis: 8, cha: 12 },
      portrait: "assets/portraits/lapadis.jpg" },

    { id: "felix",   name: "Felix",   fullName: "Felix Tinkerspark",  seat: true,  mode: "cam", ticker: true,
      level: 11, race: "Rock Gnome",    cls: "Artificer", ac: 17, hp: 80,
      stats: { str: 12, dex: 14, con: 14, int: 18, wis: 10, cha: 8 },
      portrait: "assets/portraits/felix.jpg" },

    { id: "jak",     name: "Jak",     fullName: "Jak Nara",           seat: true,  mode: "cam", ticker: true,
      level: 11, race: "Half-Elf",      cls: "Ranger",    ac: 17, hp: 92,
      stats: { str: 8, dex: 18, con: 14, int: 10, wis: 14, cha: 14 },
      portrait: "assets/portraits/jak.jpg" },

    // Verris is played by the DM, so he has no camera window, but his card is in the scrolling bar
    { id: "verris",  name: "Verris",  fullName: "Verris",             seat: false, mode: "cam", ticker: true,
      level: 11, race: "Variant Human", cls: "Fighter",   ac: 18, hp: 125,
      stats: { str: 20, dex: 14, con: 20, int: 19, wis: 8, cha: 8 },
      portrait: "assets/portraits/verris.jpg" },
  ],

  /* ---------- Scrolling title bar ---------- */
  ticker: {
    seconds: 36,           // how long each CHARACTER card stays up
    messageSeconds: 40,    // how long each MESSAGE stays up
    pattern: "mix",        // "mix" = a message, then `charactersBetween` character cards, then the next message…
                           // other options: "alternate", "party-then-messages", "messages-then-party"
    charactersBetween: 2,
    messages: [
      { icon: "emblem",  text: "Catch new campaign episodes every Tuesday @ 8:00PM EST" },
      { icon: "like",    text: "Enjoying the adventure? Smash that like button!" },
      { icon: "comment", text: "Have a favourite moment? Let us know in the comments!" },
      { icon: "heart",   text: "Do us a favor? Hit that subscribe to support the show!" },
    ],
    // icon options: "emblem", "like", "comment", "heart", "bell", or an image path like "assets/my-icon.png"
  },

  /* ---------- Break screen  (?scene=break) ---------- */
  breakScreen: {
    text: "..On a short break",
    seconds: 7,            // how long each plucked photo floats up front
    collageSize: 18,       // photos on screen at once (drawn at random from the full pool)
    plucksPerSet: 6,       // after this many plucks the collage fades to a fresh random set
    useDiscordArt: true,   // use every image from the Discord export (titles + captions live in break-images.js)
    background: "",        // optional full-screen image behind the collage (gets blurred + darkened)
    images: [],            // extra images to add to the pool, e.g. "assets/break/my-art.jpg"
                           // or { src: "assets/break/my-art.jpg", title: "Name", sub: "caption" }
  },



  /* ---------- Optional per-screen overrides ----------
     Change which seats appear (and in what order) on a single screen.
     Example:  map: { order: ["lapadis","felix","trey","darius","jak","elion"] }
  */
  scenes: {
    main:      {},
    spotlight: {},
    map:       {},
    gm:        {},
    intro:     {},
    break:     {},
  },
};
