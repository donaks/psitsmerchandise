export const ADMIN_USER_ID = "f1933af6-8628-423f-bb99-f772462fa252";

export function requireAdmin(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (userId !== ADMIN_USER_ID) {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }
  return null;
}

export function adminIdentity(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? ADMIN_USER_ID;
}
