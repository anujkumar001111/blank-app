## 2025-12-15 - mergeTools dedup cost
**Learning:** mergeTools used array indexOf to filter duplicate tool names, making the hot path of agent tool merging O(n²) when MCP exposes many tools.
**Action:** prefer Set/Map-based merges that keep order while deduping in O(n) to avoid scaling penalties during long agent loops.
