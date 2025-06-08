export async function loadGameData() {
  const regionsRes = await fetch('/data/regions.json');
  const regions = await regionsRes.json();

  const birdsRes = await fetch('/data/birds.json');
  const birds = await birdsRes.json();

  return { regions, birds };
}
