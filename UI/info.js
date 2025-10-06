const INFO_DIV = `
<div style="display:flex; flex-direction:column; height:100%;">
  <div style="flex:0 0 auto; margin-bottom:12px;">
    <h1 style="margin:0 0 8px 0;">Rigveda Word Cloud</h1>
    <p style="margin:0; text-align:justify; opacity:0.6; font-size:14px;">
      Scroll outside the cloud to scroll the view.<br>
      Click on a word to see hymns here, or enter Book/Hymn below.
    </p>
  </div>

  <!-- Selection controls -->
  <div style="flex:0 0 auto; margin-bottom:12px;">
    <label for="book-input">Book:</label>
    <input id="book-input" type="number" min="1" style="width:35px; margin-right:8px;" placeholder="1" />

    <label for="hymn-input">Hymn:</label>
    <input id="hymn-input" type="number" min="1" style="width:35px; margin-right:8px;" placeholder="1" />

    <button id="load-hymn-btn" style="margin-left:8px;" type="button">Load</button>
  </div>

  <!-- Scrollable hymn info -->
  <div id="info-scroll"
       style="flex:1 1 auto; overflow:auto; text-align:justify; padding-right:6px;"></div>
</div>
`;

function initInfoSelectors() {
  const bookInput = document.getElementById("book-input");
  const hymnInput = document.getElementById("hymn-input");
  const loadBtn = document.getElementById("load-hymn-btn");
  const infoScroll = document.getElementById("info-scroll");

  loadBtn.addEventListener("click", async () => {
    const bookId = bookInput.value;
    const hymnId = hymnInput.value;
    if (!bookId || !hymnId) return;

    const cacheKey = `${bookId}-${hymnId}`;
    let hymnData = hymnCache[cacheKey];

    if (!hymnData) {
      try {
        const res = await fetch(`/hymns/${cacheKey}`);
        if (res.ok) {
          hymnData = await res.text();
          hymnCache[cacheKey] = hymnData;
        }
      } catch (err) {
        console.error("Error loading hymn:", err);
        return;
      }
    }
    let cleanHymnData = hymnData.replace(/^"(.*)"$/, '$1');
    infoScroll.innerHTML = `<b>Book ${bookId}, Hymn ${hymnId}</b><br><br>${cleanHymnData}`;
  });
}

