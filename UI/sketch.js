// ================= Constants =================
const BASE_FONT_SCALE = 12;
const CANVAS_MARGIN = 50;
const WORD_PADDING = 8;
const SIM_BAR_HEIGHT = 12;
const SCROLL_STEP = 0.05;
const SCROLLBAR_WIDTH = 12; // width of the scrollbar


// ================= Globals =================
let similarityThreshold = 0.25;
let clusteredWords = {};
let cloudLayout;
let activeClusterId = null;
let samarkanFont;
let cloudScroll = 0;   // vertical scroll offset
let cloudHeight;       // virtual cloud height
let infoRect;
let draggingScrollbar = false;
let activeWord = null; // currently selected word
const hymnCache = {};

// ================= Lifecycle =================
function preload() {
  samarkanFont = loadFont("ui/samarkan/SAMAN.TTF", 
    () => console.log("Font loaded OK"),
    () => { 
      console.warn("Could not load Samarkan font, using fallback"); 
      samarkanFont = null; 
    }
  );
}

async function setup() {
  createCanvas(windowWidth, windowHeight);
  background(30);

  if (samarkanFont) textFont(samarkanFont);
  else textFont("Arial");

  clusteredWords = await getWordClusters(similarityThreshold);
  console.log("Initial clusters:", clusteredWords);
  cloudHeight = 5 * (height - 2 * CANVAS_MARGIN);

  const t0 = performance.now();
  cloudLayout = buildCloudLayout(
    clusteredWords,
    BASE_FONT_SCALE,
    CANVAS_MARGIN,
    CANVAS_MARGIN,
    width - 3.25 * width / 10 - 2 * CANVAS_MARGIN,
    cloudHeight
  );

  infoRect = new WordRect(
    width - 3 * width / 10 - CANVAS_MARGIN + 20,
    CANVAS_MARGIN,
    3 * width / 10 - 40,
    height - 2 * CANVAS_MARGIN,
   "<br>Click a word to see its verses here.",
    null,
    16,
    color(255, 255, 255, 255)
  );
  infoRect.isInfoBox = true;
  infoRect.draw();
  initInfoSelectors()

  const t1 = performance.now();
  console.log(`Initial layout in ${(t1 - t0).toFixed(1)} ms`);
}

function draw() {
  background(30);

  // draw word cloud with scroll offset
  push();
  translate(0, -cloudScroll);
  if (cloudLayout) cloudLayout.draw(activeClusterId);
  pop();

  //drawSimilarityBar(similarityThreshold);

  // fixed info panel
  if (infoRect){
    infoRect.draw();
  }
  // draw vertical scrollbar
  if(cloudLayout){drawScrollbar();}
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  relayoutCloud();
}

// ================= Helpers =================
function relayoutCloud() {
  cloudHeight = 3 * (height - 2 * CANVAS_MARGIN);
  cloudLayout = buildCloudLayout(
    clusteredWords,
    BASE_FONT_SCALE,
    CANVAS_MARGIN,
    CANVAS_MARGIN,
    width - 3 * width / 10 - 2 * CANVAS_MARGIN,
    cloudHeight
  );
}

function drawSimilarityBar(level) {
  push();
  for (let i = 0; i < width; i++) {
    const t = i / width;
    const c = lerpColor(color("#ff004c"), color("#00e6ff"), t);
    stroke(c);
    line(i, 0, i, SIM_BAR_HEIGHT);
  }
  noStroke();
  fill(255, 180);
  rect(0, 0, width * level, SIM_BAR_HEIGHT);

  fill(0);
  textAlign(CENTER, CENTER);
  textSize(16);
  text(nf(level, 1, 2), width / 2, SIM_BAR_HEIGHT / 2);
  pop();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function stepsFromDelta(delta) {
  const PIXELS_PER_STEP = 120;
  return Math.round(delta / PIXELS_PER_STEP) || Math.sign(delta);
}

// ================= Scrollbar =================
function drawScrollbar() {
  const visibleHeight = height - 2 * CANVAS_MARGIN;
  const barX = cloudLayout.bounds.x + cloudLayout.bounds.w + 4;
  const barY = CANVAS_MARGIN;
  const barH = visibleHeight;

  // scrollbar track
  fill(80);
  noStroke();
  rect(barX, barY, SCROLLBAR_WIDTH, barH, 6);

  // thumb size and pos
  const ratio = visibleHeight / cloudHeight;
  const thumbH = max(30, barH * ratio);
  const thumbY = barY + (barH - thumbH) * (cloudScroll / (cloudHeight - visibleHeight));

  // thumb
  fill(180);
  rect(barX, thumbY, SCROLLBAR_WIDTH, thumbH, 6);
}

function overScrollbar() {
  const visibleHeight = height - 2 * CANVAS_MARGIN;
  const barX = cloudLayout.bounds.x + cloudLayout.bounds.w + 4;
  const barY = CANVAS_MARGIN;
  return (mouseX >= barX && mouseX <= barX + SCROLLBAR_WIDTH &&
          mouseY >= barY && mouseY <= barY + visibleHeight);
}

// ================= Interaction =================
// function mouseWheel(event) {
//   const visibleHeight = height - 2 * CANVAS_MARGIN;
//   const inCloud =
//     mouseX >= cloudLayout.bounds.x &&
//     mouseX <= cloudLayout.bounds.x + cloudLayout.bounds.w &&
//     mouseY >= cloudLayout.bounds.y &&
//     mouseY <= cloudLayout.bounds.y + visibleHeight;

//   const inInfoBox =
//     mouseX >= infoRect.x &&
//     mouseX <= infoRect.x + infoRect.w &&
//     mouseY >= infoRect.y &&
//     mouseY <= infoRect.y + infoRect.h;

//   if (inCloud) {
//     const steps = stepsFromDelta(event.delta);
//     const next = clamp(
//       +(similarityThreshold + steps * SCROLL_STEP).toFixed(2),
//       0,
//       1
//     );
//     if (next !== similarityThreshold) {
//       similarityThreshold = next;
//       clusteredWords = getWordClusters(similarityThreshold);
//       cloudLayout.updateClusters(clusteredWords);
//       if (activeClusterId != null) setHoveredCluster();
//     }
//   } else if (!inInfoBox) {
//     cloudScroll = clamp(
//       cloudScroll + event.delta,
//       0,
//       cloudHeight - visibleHeight
//     );
//   }
// }

function mousePressed() {
  if (overScrollbar()) draggingScrollbar = true;
}

function mouseReleased() {
  draggingScrollbar = false;
}

function mouseDragged() {
  if (draggingScrollbar) {
    const visibleHeight = height - 2 * CANVAS_MARGIN;
    const barH = visibleHeight;
    const ratio = visibleHeight / cloudHeight;
    const thumbH = max(30, barH * ratio);

    const barTop = CANVAS_MARGIN;
    const barBottom = barTop + barH - thumbH;
    const y = clamp(mouseY - thumbH / 2, barTop, barBottom);

    const posRatio = (y - barTop) / (barBottom - barTop);
    cloudScroll = posRatio * (cloudHeight - visibleHeight);
  }
}

function mouseClicked() {
  setHoveredCluster();
  return false;
}

function setHoveredCluster() {
  if (!cloudLayout) return;
  activeClusterId = null;
  activeWord = null;
  const adjustedY = mouseY + cloudScroll;

  for (const r of cloudLayout.rects) {
    if (r.isInfoBox) continue;
    if (mouseX >= r.x && mouseX <= r.x + r.w &&
        adjustedY >= r.y && adjustedY <= r.y + r.h) {
      activeClusterId = r.cluster ?? null;
      activeWord = r.word ?? null;   // <-- store the word
      console.log("Clicked word:", activeWord);
      break;
    }
  }

  updateInfoBox(activeWord);
}
  

async function updateInfoBox(word) {
  if (!clusteredWords[word]) return;
  const hymnIds = clusteredWords[word].hymn_ids || [];

  if (hymnIds.length === 0) {
    infoRect.word = `No hymns found for "${word}".`;
    return;
  }

  const missing = hymnIds.filter(hId => !hymnCache[hId]);

  if (missing.length > 0) {
    try {
      const res = await fetch("/hymns/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(missing),
      });
      if (res.ok) {
        const bulkData = await res.json();
        Object.assign(hymnCache, bulkData);
      }
    } catch (err) {
      console.error("Error bulk loading hymns:", err);
    }
  }

  const hymnLines = hymnIds.map((hId, i) =>
    `${hymnCache[hId] ?? "[Missing hymn]"}`
  );

  infoRect.word =
    `Word: ${word}<br>Frequency: ${clusteredWords[word].freq}<br><br>` +
    hymnLines.join("<br><br>");
  infoRect.needsRedraw = true;
}
