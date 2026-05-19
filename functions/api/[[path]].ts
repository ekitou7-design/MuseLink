export async function onRequest(context: any): Promise<Response> {
  const backendBaseUrl = String(context.env.BACKEND_API_BASE_URL || "").trim().replace(/\/+$/, "");

  if (!backendBaseUrl) {
    return Response.json(
      { error: "Missing BACKEND_API_BASE_URL for Cloudflare Pages Functions API proxy." },
      { status: 500 },
    );
  }

  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const sourceUrl = new URL(context.request.url);
  const pathParam = context.params.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : String(pathParam || "");
  const targetUrl = `${backendBaseUrl}/api/${path}${sourceUrl.search}`;
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.delete("content-length");

  return fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "manual",
  });
}
