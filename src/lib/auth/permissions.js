const text = (value) => String(value || "").toUpperCase();

export function getUserScope(session) {
  const user = session?.user || {};

  const role = text(user.role_id || user.role_name);
  const location = text(
    user.location_code || user.location_name || user.location_id
  );

  if (role.includes("OWNER") || role.includes("SUPER")) return "OWNER";
  if (location.includes("TGR") || location.includes("TANGERANG")) return "TANGERANG";
  if (location.includes("PML") || location.includes("PEMALANG")) return "PEMALANG";
  if (location.includes("CBN") || location.includes("CIBINONG")) return "CIBINONG";

  return "STAFF";
}

export function canSeeGroup(group, session) {
  const scope = getUserScope(session);
  const visibleFor = group.visibleFor || ["OWNER"];

  if (visibleFor.includes("ALL")) return true;
  if (scope === "OWNER") return true;

  return visibleFor.includes(scope);
}

export function getAllowedMenuGroups(menuGroups, session) {
  return menuGroups
    .filter((group) => canSeeGroup(group, session))
    .map((group) => ({
      ...group,
      items: group.items || [],
    }))
    .filter((group) => group.items.length > 0);
}
