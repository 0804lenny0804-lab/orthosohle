export async function loadPlan() {
  const response = await fetch("/api/plan", { cache: "no-store" });
  if (!response.ok)
    throw new Error("Der Therapieplan konnte nicht geladen werden.");
  const data = await response.json();
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Die API hat einen ungültigen Plan geliefert.");
  }
  const validPlan =
    data.plan === null ||
    (Number.isFinite(data.plan?.limitKg) &&
      data.plan.limitKg > 0 &&
      Number.isInteger(data.plan.version) &&
      data.plan.version > 0);
  if (
    !["demo", "unconfigured"].includes(data.source) ||
    !validPlan ||
    data.deviceApplied !== false ||
    (data.source === "unconfigured" && data.plan !== null)
  ) {
    throw new Error("Die API hat einen ungültigen Plan geliefert.");
  }
  return data;
}
