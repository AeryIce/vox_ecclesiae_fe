export const dynamic = "force-dynamic";

type HealthResponse = {
  ok: boolean;
  service?: string;
  time?: string;
};

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export default async function HealthPage() {
  const baseUrlRaw = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrlRaw) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>FE ↔ BE: Not configured</h1>
        <p>
          Set <code>NEXT_PUBLIC_API_BASE_URL</code> dulu (contoh:
          <code> https://your-backend-domain</code>).
        </p>
      </main>
    );
  }

  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  const url = `${baseUrl}/api/health`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return (
        <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h1>Connected: ❌</h1>
          <p>Endpoint: <code>{url}</code></p>
          <p>Status: <code>{res.status}</code></p>
        </main>
      );
    }

    const data = (await res.json()) as HealthResponse;

    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Connected ✅</h1>
        <p>Endpoint: <code>{url}</code></p>
        <pre style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, overflowX: "auto" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </main>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Connected: ❌</h1>
        <p>Endpoint: <code>{url}</code></p>
        <p>Error: <code>{message}</code></p>
      </main>
    );
  }
}