async function getWordClusters(similarityThreshold = 0.5) {
  try {
    // normalize threshold to 2 decimals, just like the backend
    const sim = similarityThreshold.toFixed(2);

    // call FastAPI endpoint
    const response = await fetch(`/clusters/${sim}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch clusters: ${response.statusText}`);
    }

    // parse JSON
    const clusters = await response.json();
    return clusters; 
    // object: { word: {cluster, freq, hymn_ids}, ... }
  } catch (err) {
    console.error("Error fetching word clusters:", err);
    return {};
  }
}

function generateBrightColor(clusterId) {
  const prime = 137;
  const hue = (clusterId * prime) % 360;
  const sat = 40;
  const light = 50;

  return hslToRgb(hue, sat / 100, light / 100);
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}
