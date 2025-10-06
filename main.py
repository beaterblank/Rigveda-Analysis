from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import json
import os

app = FastAPI()

# ---- Load data ----
with open("data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

linkage_flat = data["linkage"]
vocab_flat = data["vocab_freq"]
hymns = data["hymns"]

# --- Parse vocab & freqs ---
vocab = []
freqs = {}
word_to_hymns = {}
for i in range(len(vocab_flat)):
    word = vocab_flat[i][0]
    freq = vocab_flat[i][1]
    hymn_ids = vocab_flat[i][2]
    vocab.append(word)
    freqs[word] = freq
    word_to_hymns[word] = hymn_ids

n = len(vocab)
total_nodes = 2 * n - 1

# --- Parse linkage ---
linkage = []
for i in range(0, len(linkage_flat), 4):
    linkage.append([
        linkage_flat[i],
        linkage_flat[i + 1],
        linkage_flat[i + 2],
        linkage_flat[i + 3],
    ])

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

# --- Clustering function ---
def cluster_words(similarity_threshold: float):
    """
    Groups words into clusters based on the given cosine similarity threshold.
    linkage[i] = [a, b, dist, size]
    Smaller dist = more similar.
    """
    dist_cutoff = 1 - clamp(similarity_threshold, 0, 1)

    parent = list(range(total_nodes))

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    # Merge clusters progressively
    for k, (a, b, dist, _) in enumerate(linkage):
        new_idx = n + k
        if dist <= dist_cutoff:
            union(int(a), int(b))
            union(int(a), new_idx)
            union(int(b), new_idx)
        else:
            break

    # Assign cluster IDs
    rep_to_cluster = {}
    cluster_counter = 0
    word_info = {}

    for i, word in enumerate(vocab):
        rep = find(i)
        if rep not in rep_to_cluster:
            rep_to_cluster[rep] = cluster_counter
            cluster_counter += 1
        cluster_id = rep_to_cluster[rep]
        word_info[word] = {
            "cluster": cluster_id,
            "freq": freqs[word],
            "hymn_ids": word_to_hymns[word],
        }

    print(
        f"[cluster_words] sim={similarity_threshold:.2f}, "
        f"cutoff={dist_cutoff:.2f}, clusters={cluster_counter}"
    )

    return word_info


# ---- Cache ----
cluster_cache = {}

# ---- API endpoints ----
@app.get("/clusters/{sim}")
async def get_clusters(sim: float):
    sim = round(sim, 2)
    if sim < 0 or sim > 1:
        raise HTTPException(status_code=400, detail="Similarity must be between 0 and 1")

    if sim not in cluster_cache:
        cluster_cache[sim] = cluster_words(sim)

    return cluster_cache[sim]


@app.get("/hymns/{hymn_id}")
async def get_hymn(hymn_id: str):
    if hymn_id not in hymns:
        raise HTTPException(status_code=404, detail="Hymn not found")
    return hymns[hymn_id]


@app.post("/hymns/bulk")
async def get_bulk_hymns(hymn_ids: list[str] = Body(...)):
    results = {}
    for hid in hymn_ids:
        if hid in hymns:
            results[hid] = hymns[hid]
    if not results:
        raise HTTPException(status_code=404, detail="No hymns found")
    return results


# ---- Serve UI ----
ui_dir = os.path.join(os.path.dirname(__file__), "UI")
app.mount("/ui", StaticFiles(directory=ui_dir), name="ui")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(ui_dir, "index.html"))


# ---- Run locally ----
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000, log_level="info")
