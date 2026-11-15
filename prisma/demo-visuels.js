// Demo product visuals for the seed: one SVG illustration per ball, generated in code.
// The seed uploads them to Cloudinary (converted to PNG), like an image sent from the back office.

const W = 800;
const CX = 400;
const CY = 380;
const R = 250;

const f = (n) => Math.round(n * 10) / 10;
const rad = (deg) => (deg * Math.PI) / 180;
const pt = (cx, cy, r, deg) => [f(cx + r * Math.cos(rad(deg))), f(cy + r * Math.sin(rad(deg)))];

// Regular polygon whose first vertex points towards angle `rot`
const polygone = (cx, cy, r, rot, n = 5) =>
  Array.from({ length: n }, (_, i) => pt(cx, cy, r, rot + (360 / n) * i));
const points = (pts) => pts.map((p) => p.join(",")).join(" ");

// Classic truncated-icosahedron look: central pentagon, 5 outer pentagons, seams between them
function motifFootball({ fond, patch, couture }) {
  const p = R * 0.27;
  const centre = polygone(CX, CY, p, -90);
  const exterieurs = [];
  const lignes = [];
  for (let k = 0; k < 5; k++) {
    const angle = -90 + 72 * k;
    const [ox, oy] = pt(CX, CY, R * 0.9, angle);
    exterieurs.push(polygone(ox, oy, R * 0.26, angle + 180));
  }
  for (let k = 0; k < 5; k++) {
    const ext = exterieurs[k];
    const suivant = exterieurs[(k + 1) % 5];
    lignes.push([centre[k], ext[0]]); // central vertex -> inner vertex of outer pentagon
    lignes.push([ext[4], suivant[1]]); // hexagon edge between two outer pentagons
  }
  return `
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${fond}"/>
    <g clip-path="url(#balle)" stroke="${couture}" stroke-width="5" stroke-linejoin="round">
      <polygon points="${points(centre)}" fill="${patch}"/>
      ${exterieurs.map((e) => `<polygon points="${points(e)}" fill="${patch}"/>`).join("")}
      ${lignes.map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`).join("")}
    </g>`;
}

function motifBasket({ fond, couture }) {
  const s = `fill="none" stroke="${couture}" stroke-width="9" stroke-linecap="round"`;
  return `
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${fond}"/>
    <g clip-path="url(#balle)">
      <path d="M${CX - 10},${CY - R} Q${CX + 35},${CY} ${CX - 10},${CY + R}" ${s}/>
      <path d="M${CX - R},${CY + 10} Q${CX},${CY - 30} ${CX + R},${CY + 10}" ${s}/>
      <path d="M${CX - R * 0.72},${CY - R * 0.72} Q${CX - R * 0.2},${CY} ${CX - R * 0.72},${CY + R * 0.72}" ${s}/>
      <path d="M${CX + R * 0.72},${CY - R * 0.72} Q${CX + R * 0.2},${CY} ${CX + R * 0.72},${CY + R * 0.72}" ${s}/>
    </g>`;
}

// Three swirling panels of three strips each, like a volleyball
function motifVolley({ couleurs, couture }) {
  const rb = R * 1.05;
  // Same swirl curve for every boundary, rotated by 120°, so the panels tile the ball exactly
  const swirl = (a) => ({ ctrl: pt(CX, CY, R * 0.75, a + 35), bord: pt(CX, CY, rb, a) });
  let panneaux = "";
  let coutures = "";
  for (let k = 0; k < 3; k++) {
    const a = -90 + 120 * k;
    const s1 = swirl(a);
    const s2 = swirl(a + 120);
    panneaux += `<path d="M${CX},${CY} Q${s1.ctrl} ${s1.bord} A${rb},${rb} 0 0 1 ${s2.bord} Q${s2.ctrl} ${CX},${CY} Z"
      fill="${couleurs[k]}" stroke="${couture}" stroke-width="6" stroke-linejoin="round"/>`;
    // Two strip seams inside each panel, parallel to its boundary
    for (const j of [1, 2]) {
      const debut = pt(CX, CY, R * 0.2 * j, a + 120);
      const ctrl = pt(CX, CY, R * 0.8, a + 35 + 40 * j);
      const fin = pt(CX, CY, rb, a + 40 * j);
      coutures += `<path d="M${debut} Q${ctrl} ${fin}" fill="none" stroke="${couture}" stroke-width="4" opacity="0.6"/>`;
    }
  }
  return `<g clip-path="url(#balle)">${panneaux}${coutures}</g>`;
}

// Handball: base colour crossed by a wide wavy band and panel seams
function motifHand({ fond, bande, couture }) {
  return `
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${fond}"/>
    <g clip-path="url(#balle)" stroke="${couture}" stroke-width="5">
      <path d="M${CX - R},${CY - 40} C${CX - 120},${CY - 180} ${CX + 80},${CY + 60} ${CX + R},${CY - 90}
               L${CX + R},${CY + 40} C${CX + 80},${CY + 190} ${CX - 120},${CY - 50} ${CX - R},${CY + 90} Z" fill="${bande}"/>
      <path d="M${CX - 60},${CY - R} Q${CX - 140},${CY} ${CX - 60},${CY + R}" fill="none"/>
      <path d="M${CX + 70},${CY - R} Q${CX + 150},${CY} ${CX + 70},${CY + R}" fill="none"/>
    </g>`;
}

const MOTIFS = { football: motifFootball, basket: motifBasket, volley: motifVolley, hand: motifHand };

// Views of the same ball, for the product gallery
const VUES = {
  face: { motif: "", balle: "" },
  rotation: { motif: `rotate(40 ${CX} ${CY})`, balle: "" },
  // Close-up: bigger ball, partly out of frame
  zoom: { motif: "", balle: `translate(${CX} ${CY + 40}) scale(1.45) translate(${-CX} ${-CY})` },
};
const NB_VUES = Object.keys(VUES).length;

// v = { motif, decor: [dark, light], ...motif colours }, see the products in seed.js
// vue = index in VUES (0 = main picture). No text on the picture: the store already shows
// the size and puts its own badges (offer, stock) in the top corners.
function genererSvg(v, vue = 0) {
  const [sombre, clair] = v.decor;
  const { motif, balle } = Object.values(VUES)[vue];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <defs>
    <linearGradient id="decor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${clair}"/>
      <stop offset="1" stop-color="${sombre}"/>
    </linearGradient>
    <radialGradient id="volume" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>
    <radialGradient id="ombre">
      <stop offset="0" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="balle"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#decor)"/>
  <circle cx="120" cy="680" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="700" cy="120" r="160" fill="#ffffff" opacity="0.08"/>
  <g transform="${balle}">
    <ellipse cx="${CX}" cy="${CY + R + 45}" rx="${R * 0.85}" ry="34" fill="url(#ombre)"/>
    <g transform="${motif}">${MOTIFS[v.motif](v)}</g>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#volume)"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#000000" stroke-opacity="0.25" stroke-width="3"/>
  </g>
</svg>
`;
}

module.exports = { genererSvg, NB_VUES };
