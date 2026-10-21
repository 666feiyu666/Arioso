const url = "https://en.wikipedia.org/w/api.php?action=query&titles=List%20of%20blues%20genres&prop=revisions&rvprop=ids&format=json&formatversion=2";
try {
  const r = await fetch(url, { headers: { "User-Agent": "AriosoMusicCorpus/0.1 (academic research corpus builder)" }, signal: AbortSignal.timeout(20000) });
  console.log("status", r.status);
  console.log((await r.text()).slice(0, 300));
} catch (e) {
  console.log("ERROR", e.name, e.message, e.cause?.code ?? "");
}
