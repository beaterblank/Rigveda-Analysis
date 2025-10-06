// ================== Word Rect ==================
class WordRect {
  constructor(x, y, w, h, word, clusterId, fontSize = 16, col = [255]) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.area = w * h;
    this.word = word;
    this.fontSize = fontSize;
    this.color = col;
    this.cluster = clusterId;
    this.isInfoBox = false;
    this.htmlEl = null; 
    this.needsRedraw = true; 
  }

  draw(alphaOverride = null) {
    push();
    noStroke();

    const c = color(this.color);
    const r = red(c), g = green(c), b = blue(c);
    const a = alphaOverride == null ? alpha(c) : alphaOverride;

    textSize(this.fontSize);

    if (this.isInfoBox) {
      // draw outline box
      noFill();
      stroke(255, 50);
      strokeWeight(1);
      rect(this.x, this.y, this.w, this.h, 10);

      // create HTML overlay once
      if (!this.htmlEl) {
        this.htmlEl = createDiv(INFO_DIV);
        this.htmlEl.style('position', 'absolute');
        this.htmlEl.style('overflow', 'hidden');
        this.htmlEl.style('padding', '32px');
        this.htmlEl.style('width', (this.w - 64) + 'px');
        this.htmlEl.style('height', (this.h - 64) + 'px');
        this.htmlEl.style('color', 'white');
        this.htmlEl.style('font-size', this.fontSize + 'px');
        this.htmlEl.style('line-height', '1.4');
        this.htmlEl.style('user-select', 'text');
        this.htmlEl.style('font-family', 'monospace, Arial, sans-serif');
      }

      // always update content whenever needsRedraw OR first creation
      if (this.needsRedraw && this.htmlEl) {
        const scrollDiv = this.htmlEl.elt.querySelector("#info-scroll");
        if (scrollDiv) {
          scrollDiv.innerHTML = this.word || "<i>No content</i>";
        }
        this.needsRedraw = false;
      }

      this.htmlEl.position(this.x, this.y);

    } else {
      // normal cloud words
      fill(255 - r, 255 - g, 255 - b, a);
      textAlign(CENTER, CENTER);
      text(this.word, this.x + this.w / 2, this.y + this.h / 2);

      if (this.htmlEl) {
        this.htmlEl.remove();
        this.htmlEl = null;
      }
    }

    pop();
  }
}

class CloudLayout {
  constructor(bx, by, bw, bh) {
    if (new.target === CloudLayout) {
      throw new Error("Cannot instantiate abstract class CloudLayout directly");
    }
    this.bounds = { x: bx, y: by, w: bw, h: bh };
    this.rects = [];
    this.wordMap = new Map();
    this.queue = []; // pending items
  }

  // Abstract method: must be overridden
  addRect(w, h, word, clusterId, fontSize, col) {
    throw new Error("addRect() must be implemented by subclass");
  }

  // Enqueue new items to be placed later
  enqueueItems(items) {
    this.queue.push(...items);
  }

  // Consume ~10% of the queue each frame
  consumeQueue(ratio = 0.1) {
    if (this.queue.length === 0) return;

    const count = Math.max(1, Math.floor(this.queue.length * ratio));
    for (let i = 0; i < count && this.queue.length > 0; i++) {
      const it = this.queue.shift();
      this.addRect(it.w, it.h, it.word, it.cluster, it.fs, generateBrightColor(it.cluster));
    }
  }

  // Optional shared behavior
  updateClusters(newClusters) {
    for (const [word, rect] of this.wordMap.entries()) {
      const newInfo = newClusters[word];
      if (newInfo) {
        rect.cluster = newInfo.cluster;
        rect.color = generateBrightColor(newInfo.cluster);
      }
    }
  }

  draw(highlightCluster = null, dimAlpha = 60) {
    // Consume part of queue each frame
    this.consumeQueue(0.1);

    // Outline of layout area
    push();
    noFill();
    stroke(255, 50);
    strokeWeight(1);
    rect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h, 10);
    pop();

    for (const r of this.rects) {
      if (highlightCluster == null || r.cluster === highlightCluster) {
        r.draw();
      } else {
        r.draw(dimAlpha);
      }
    }
  }
}


class CornerPacker extends CloudLayout {
  constructor(bx, by, bw, bh) {
    super(bx, by, bw, bh);
    this.corners = [{ x: bx, y: by }]; // start top-left
  }

  addRect(w, h, word, cluster, fontSize, col) {
    let chosen = null;

    for (const c of this.corners) {
      const rect = { x: c.x, y: c.y, w, h };

      if (!this._fits(rect)) continue;

      if (!chosen ||
          rect.y < chosen.y ||
          (rect.y === chosen.y && rect.x < chosen.x)) {
        chosen = rect;
      }
    }

    if (!chosen) return false;

    const wordRect = new WordRect(
      chosen.x, chosen.y, w, h, word, cluster, fontSize, col
    );
    this.rects.push(wordRect);
    this.wordMap.set(word, wordRect);

    this._updateCorners(wordRect);
    return true;
  }

  _fits(rect) {
    if (rect.x + rect.w > this.bounds.x + this.bounds.w) return false;
    if (rect.y + rect.h > this.bounds.y + this.bounds.h) return false;
    for (const r of this.rects) {
      if (this._overlaps(rect, r)) return false;
    }
    return true;
  }

  _overlaps(a, b) {
    return !(a.x + a.w <= b.x ||
             a.x >= b.x + b.w ||
             a.y + a.h <= b.y ||
             a.y >= b.y + b.h);
  }

  _updateCorners(rect) {
    // new candidate corners: right and bottom
    this.corners.push({ x: rect.x + rect.w, y: rect.y });
    this.corners.push({ x: rect.x, y: rect.y + rect.h });

    // prune corners that are covered by existing rects
    this.corners = this.corners.filter(c => {
      return !this.rects.some(r => 
        c.x >= r.x && c.x < r.x + r.w &&
        c.y >= r.y && c.y < r.y + r.h
      );
    });
  }
}

// ================== Utils ==================
function measureWordSize(word, fontSize, pad = WORD_PADDING) {
  push();
  textSize(fontSize);
  const w = textWidth(word) + 3 * pad;
  const h = textAscent() + textDescent() + 0.75 * pad;
  pop();
  return { w, h };
}


function shuffleArray(arr, start, end) {
  for (let i = end - 1; i > start; i--) {
    const j = start + Math.floor(Math.random() * (i - start + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function shuffleInChunks(items, chunkSize = 100) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, items.length);
    shuffleArray(items, i, end);
  }
  return items;
}


let stopAdding = false;

function streamWords(layout, items) {
  for (const it of items) {
    if (stopAdding) break;

    layout.addRectAsync(it.w, it.h, it.word, it.cluster, it.fs, generateBrightColor(it.cluster))
      .then(ok => {
        if (!ok) {
          console.warn("Stopping: no more space.");
          stopAdding = true;
        }
      });
  }
}


// ================== Layout Builder ==================
function buildCloudLayout(wordClusters, baseFont, bx, by, bw, bh) {
  console.log("Building cloud layout...");
  const layout = new CornerPacker(bx, by, bw, bh);
  const words = Object.keys(wordClusters);
  if (words.length === 0) return layout;

  const freqs = words.map(w => wordClusters[w].freq);
  const minF = Math.min(...freqs);
  const maxF = Math.max(...freqs);
  const minFontSize = Math.max(8, baseFont * 2);
  const maxFontSize = Math.max(minFontSize + 1, baseFont * 10);

  const items = words.map(word => {
    const f = wordClusters[word].freq;
    const fs = map(f, minF, maxF, minFontSize, maxFontSize);
    const { w, h } = measureWordSize(word, fs, WORD_PADDING);
    return { word, fs, w, h, area: w * h, cluster: wordClusters[word].cluster };
  });

  // Sort big → small (packing works best this way)
  items.sort((a, b) => b.area - a.area);
  shuffleInChunks(items, 500);

  // Instead of placing immediately, enqueue
  layout.enqueueItems(items);
  return layout;
}