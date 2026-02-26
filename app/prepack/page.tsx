"use client";

import { useState } from "react";

type Purpose = "edukasi" | "inspirasi" | "ajakan" | "info_kegiatan";
type Format = "interview" | "panel";
type Formality = "formal_ringan" | "sangat_formal" | "hangat_ramah";

type PrepackRundownItem = {
  segment: string;
  minutes: number;
  goal: string;
};

type PrepackQuestion = {
  q: string;
  followups: string[];
};

type PrepackMomentTarget = {
  label: string;
  why: string;
  where: string;
};

type PrepackPayload = {
  working_title: string;
  opening_hook: string;
  rundown: PrepackRundownItem[];
  questions: PrepackQuestion[];
  moment_targets: PrepackMomentTarget[];
  closing_cta: string;
};

type AiMeta = {
  used: boolean;
  model?: string;
  error?: string;
  reason?: string;
};

type ApiResponse = {
  ok: boolean;
  pack_type: "pre";
  version: string;
  ai?: AiMeta;
  input: unknown;
  prepack: PrepackPayload;
  markdown: string;
};

type FormState = {
  topic: string;
  purpose: Purpose;
  audience: string;
  duration_minutes: string;
  format: Format;
  guest_role_context: string;
  must_points_text: string;
  salutation: string;
  formality: Formality;
  sensitive_constraints: string;
};

type FieldKey = keyof FormState;

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function splitMustPoints(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const card =
  "border rounded-xl p-4 bg-[color:var(--surface)] border-[color:var(--border)] shadow-sm";
const subCard =
  "border rounded p-3 bg-[color:var(--surface-2)] border-[color:var(--border)]";
const inputBase =
  "border rounded px-3 py-2 bg-[color:var(--surface-2)] border-[color:var(--border)] " +
  "focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]";
const btnPrimary =
  "rounded px-4 py-2 font-semibold bg-[color:var(--accent)] text-white " +
  "hover:bg-[color:var(--accent-2)] disabled:opacity-60";
const btnGhost =
  "border rounded px-3 py-2 text-sm bg-[color:var(--surface-2)] border-[color:var(--border)] " +
  "hover:bg-[color:var(--surface)]";

const tabBtnBase =
  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold border transition " +
  "border-[color:var(--border)]";
const tabBtnActive = `${tabBtnBase} bg-[color:var(--accent)] text-white border-transparent`;
const tabBtnInactive = `${tabBtnBase} bg-[color:var(--surface-2)] hover:bg-[color:var(--surface)]`;

const stickyBar =
  "md:hidden fixed bottom-0 left-0 right-0 p-3 " +
  "bg-[color:var(--surface)]/95 backdrop-blur border-t border-[color:var(--border)]";

const toast =
  "md:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-50 " +
  "px-3 py-2 rounded-lg text-sm shadow-sm border " +
  "bg-[color:var(--surface)] border-[color:var(--border)]";

export default function PrepackPage() {
  const baseUrlRaw = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [activeTab, setActiveTab] = useState<"input" | "output">("input");

  const [form, setForm] = useState<FormState>({
    topic: "",
    purpose: "inspirasi",
    audience: "OMK",
    duration_minutes: "25",
    format: "interview",
    guest_role_context: "Romo paroki / narasumber",
    must_points_text: "Makna inti topik\nRealita di lapangan\nLangkah kecil minggu ini",
    salutation: "Romo",
    formality: "formal_ringan",
    sensitive_constraints: "Hindari politik, hindari sebut nama orang",
  });

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string>("");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [copyMsg, setCopyMsg] = useState<string>("");

  if (!baseUrlRaw) {
    return (
      <main className="p-6 max-w-3xl mx-auto min-h-screen">
        <h1 className="text-2xl font-semibold">Vox Ecclesiae — PRE Pack</h1>
        <p className="mt-3">
          Env belum diset. Tambahin{" "}
          <code className="px-1 py-0.5 border rounded">NEXT_PUBLIC_API_BASE_URL</code>{" "}
          ke <code className="px-1 py-0.5 border rounded">.env.local</code> / Vercel.
        </p>
      </main>
    );
  }

  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  const endpoint = `${baseUrl}/api/prepack`;

  const setField = <K extends FieldKey>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<FieldKey, string>> = {};

    if (form.topic.trim().length < 3) next.topic = "Topik minimal 3 karakter.";
    if (form.audience.trim().length < 2) next.audience = "Audiens minimal 2 karakter.";
    if (form.guest_role_context.trim().length < 3)
      next.guest_role_context = "Konteks narasumber minimal 3 karakter.";

    const duration = Number(form.duration_minutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 180) {
      next.duration_minutes = "Durasi harus angka 5–180.";
    }

    const mustPoints = splitMustPoints(form.must_points_text);
    if (mustPoints.length < 1) next.must_points_text = "Minimal 1 poin wajib (1 baris = 1 poin).";

    if (form.salutation.trim().length < 2) next.salutation = "Sapaan minimal 2 karakter.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    setApiError("");
    setCopyMsg("");
    setResult(null);

    if (!validate()) return;

    setLoading(true);
    try {
      const duration = Number(form.duration_minutes);
      const must_points = splitMustPoints(form.must_points_text);

      const payload = {
        topic: form.topic.trim(),
        purpose: form.purpose,
        audience: form.audience.trim(),
        duration_minutes: duration,
        format: form.format,
        guest_role_context: form.guest_role_context.trim(),
        must_points,
        salutation: form.salutation.trim(),
        formality: form.formality,
        sensitive_constraints: form.sensitive_constraints.trim().length
          ? form.sensitive_constraints.trim()
          : null,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();

      if (!res.ok) {
        setApiError(`BE error (${res.status}): ${rawText}`);
        return;
      }

      const data = JSON.parse(rawText) as ApiResponse;
      if (!data.ok) {
        setApiError("Response ok=false (cek BE).");
        return;
      }

      setResult(data);
      setActiveTab("output");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onCopyMarkdown = async () => {
    if (!result) return;
    const ok = await copyToClipboard(result.markdown);
    setCopyMsg(ok ? "Markdown copied ✅" : "Gagal copy (browser block).");
    window.setTimeout(() => setCopyMsg(""), 2000);
  };

  const onCopyJson = async () => {
    if (!result) return;
    const ok = await copyToClipboard(JSON.stringify(result.prepack, null, 2));
    setCopyMsg(ok ? "JSON copied ✅" : "Gagal copy (browser block).");
    window.setTimeout(() => setCopyMsg(""), 2000);
  };

  return (
    <main className="p-4 md:p-6 max-w-5xl mx-auto min-h-screen pb-24 md:pb-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Vox Ecclesiae — PRE Pack Generator</h1>
        <p className="opacity-80 mt-1">
          Endpoint: <code className="px-1 py-0.5 border rounded">{endpoint}</code>
        </p>
      </header>

      {/* Mobile Tabs */}
      <div className="md:hidden mb-4 flex gap-2">
        <button
          type="button"
          className={activeTab === "input" ? tabBtnActive : tabBtnInactive}
          onClick={() => setActiveTab("input")}
        >
          Input
        </button>
        <button
          type="button"
          className={activeTab === "output" ? tabBtnActive : tabBtnInactive}
          onClick={() => setActiveTab("output")}
        >
          Output
        </button>
      </div>

      {/* Mobile copy toast */}
      {copyMsg ? <div className={toast}>{copyMsg}</div> : null}

      <section className="grid gap-6 md:grid-cols-2">
        {/* FORM */}
        <div className={`${card} ${activeTab === "input" ? "" : "hidden md:block"}`}>
          <h2 className="text-lg font-semibold">Input</h2>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Topik</span>
              <input
                className={inputBase}
                value={form.topic}
                onChange={(e) => setField("topic", e.target.value)}
                placeholder="Contoh: Tetap Taat di Masa Tenang"
              />
              {errors.topic ? <span className="text-sm text-red-600">{errors.topic}</span> : null}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm opacity-80">Tujuan</span>
                <select
                  className={inputBase}
                  value={form.purpose}
                  onChange={(e) => setField("purpose", e.target.value as Purpose)}
                >
                  <option value="edukasi">edukasi</option>
                  <option value="inspirasi">inspirasi</option>
                  <option value="ajakan">ajakan</option>
                  <option value="info_kegiatan">info kegiatan</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm opacity-80">Format</span>
                <select
                  className={inputBase}
                  value={form.format}
                  onChange={(e) => setField("format", e.target.value as Format)}
                >
                  <option value="interview">interview</option>
                  <option value="panel">panel</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm opacity-80">Audiens</span>
                <input
                  className={inputBase}
                  value={form.audience}
                  onChange={(e) => setField("audience", e.target.value)}
                />
                {errors.audience ? <span className="text-sm text-red-600">{errors.audience}</span> : null}
              </label>

              <label className="grid gap-1">
                <span className="text-sm opacity-80">Durasi (menit)</span>
                <input
                  className={inputBase}
                  value={form.duration_minutes}
                  onChange={(e) => setField("duration_minutes", e.target.value)}
                />
                {errors.duration_minutes ? (
                  <span className="text-sm text-red-600">{errors.duration_minutes}</span>
                ) : null}
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm opacity-80">Konteks narasumber</span>
              <input
                className={inputBase}
                value={form.guest_role_context}
                onChange={(e) => setField("guest_role_context", e.target.value)}
              />
              {errors.guest_role_context ? (
                <span className="text-sm text-red-600">{errors.guest_role_context}</span>
              ) : null}
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-80">Poin wajib (1 baris = 1 poin, max 5)</span>
              <textarea
                className={`${inputBase} min-h-[110px]`}
                value={form.must_points_text}
                onChange={(e) => setField("must_points_text", e.target.value)}
              />
              {errors.must_points_text ? (
                <span className="text-sm text-red-600">{errors.must_points_text}</span>
              ) : null}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm opacity-80">Sapaan</span>
                <input
                  className={inputBase}
                  value={form.salutation}
                  onChange={(e) => setField("salutation", e.target.value)}
                />
                {errors.salutation ? (
                  <span className="text-sm text-red-600">{errors.salutation}</span>
                ) : null}
              </label>

              <label className="grid gap-1">
                <span className="text-sm opacity-80">Gaya bahasa</span>
                <select
                  className={inputBase}
                  value={form.formality}
                  onChange={(e) => setField("formality", e.target.value as Formality)}
                >
                  <option value="formal_ringan">formal ringan</option>
                  <option value="hangat_ramah">hangat ramah</option>
                  <option value="sangat_formal">sangat formal</option>
                </select>
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm opacity-80">Batasan sensitif (opsional)</span>
              <textarea
                className={`${inputBase} min-h-[80px]`}
                value={form.sensitive_constraints}
                onChange={(e) => setField("sensitive_constraints", e.target.value)}
              />
            </label>

            {/* Desktop button (mobile uses sticky bar) */}
            <button
              type="button"
              className={`${btnPrimary} hidden md:inline-flex justify-center`}
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate PRE Pack"}
            </button>

            {apiError ? (
              <div className="border border-red-400 rounded p-3 text-sm bg-white/30 dark:bg-black/20">
                <div className="font-semibold text-red-600">Error</div>
                <pre className="whitespace-pre-wrap mt-1">{apiError}</pre>
              </div>
            ) : null}

            {/* Desktop copy message */}
            {copyMsg ? <div className="hidden md:block text-sm opacity-80">{copyMsg}</div> : null}
          </div>
        </div>

        {/* RESULT */}
        <div className={`${card} ${activeTab === "output" ? "" : "hidden md:block"}`}>
          <h2 className="text-lg font-semibold">Output</h2>

          {!result ? (
            <p className="opacity-70 mt-4">Belum ada hasil. Isi form lalu generate 😄</p>
          ) : (
            <div className="mt-4 grid gap-4">
              {/* Desktop copy buttons (mobile uses sticky bar) */}
              <div className="hidden md:flex gap-2 flex-wrap">
                <button type="button" className={btnGhost} onClick={onCopyMarkdown}>
                  Copy Markdown
                </button>
                <button type="button" className={btnGhost} onClick={onCopyJson}>
                  Copy JSON
                </button>
              </div>
              {result?.ai ? (
                <div className="border rounded p-3 bg-[color:var(--surface-2)] border-[color:var(--border)] text-sm">
                  <div className="font-semibold">Engine</div>
                  <div>
                    version: <code>{result.version}</code>
                  </div>
                  <div>
                    ai.used: <code>{String(result.ai.used)}</code>
                  </div>
                  {result.ai.model ? (
                    <div>
                      model: <code>{result.ai.model}</code>
                    </div>
                  ) : null}
                  {result.ai.error ? (
                    <div className="mt-2">
                      <div className="font-semibold text-red-600">ai.error</div>
                      <pre className="whitespace-pre-wrap">{result.ai.error}</pre>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Mobile: collapsible sections */}
              <div className="md:hidden grid gap-3">
                <details className={subCard} open>
                  <summary className="font-semibold cursor-pointer">Judul kerja</summary>
                  <div className="mt-2">{result.prepack.working_title}</div>
                </details>

                <details className={subCard} open>
                  <summary className="font-semibold cursor-pointer">Opening hook</summary>
                  <p className="mt-2 whitespace-pre-wrap">{result.prepack.opening_hook}</p>
                </details>

                <details className={subCard}>
                  <summary className="font-semibold cursor-pointer">Rundown</summary>
                  <ul className="mt-2 list-disc pl-5 grid gap-1">
                    {result.prepack.rundown.map((s) => (
                      <li key={`${s.segment}-${s.minutes}`}>
                        <span className="font-semibold">{s.segment}</span>{" "}
                        <span className="opacity-80">({s.minutes}m)</span> — {s.goal}
                      </li>
                    ))}
                  </ul>
                </details>

                <details className={subCard}>
                  <summary className="font-semibold cursor-pointer">Pertanyaan</summary>
                  <ol className="mt-2 list-decimal pl-5 grid gap-3">
                    {result.prepack.questions.map((qItem) => (
                      <li key={qItem.q}>
                        <div className="font-semibold">{qItem.q}</div>
                        <ul className="mt-1 list-disc pl-5 opacity-90 grid gap-1">
                          {qItem.followups.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </details>

                <details className={subCard}>
                  <summary className="font-semibold cursor-pointer">Moment targets</summary>
                  <ul className="mt-2 list-disc pl-5 grid gap-1">
                    {result.prepack.moment_targets.map((m) => (
                      <li key={`${m.label}-${m.where}`}>
                        <span className="font-semibold">{m.label}</span>{" "}
                        <span className="opacity-80">({m.where})</span> — {m.why}
                      </li>
                    ))}
                  </ul>
                </details>

                <details className={subCard}>
                  <summary className="font-semibold cursor-pointer">Closing CTA</summary>
                  <p className="mt-2 whitespace-pre-wrap">{result.prepack.closing_cta}</p>
                </details>

                <details className={subCard}>
                  <summary className="font-semibold cursor-pointer">Markdown (siap copy-paste)</summary>
                  <pre className="mt-2 whitespace-pre-wrap max-h-[55vh] overflow-auto text-sm">
                    {result.markdown}
                  </pre>
                </details>
              </div>

              {/* Desktop: expanded sections */}
              <div className="hidden md:grid gap-4">
                <div className={subCard}>
                  <div className="text-sm opacity-80">Judul kerja</div>
                  <div className="font-semibold mt-1">{result.prepack.working_title}</div>
                </div>

                <div className={subCard}>
                  <div className="text-sm opacity-80">Opening hook</div>
                  <p className="mt-1 whitespace-pre-wrap">{result.prepack.opening_hook}</p>
                </div>

                <div className={subCard}>
                  <div className="text-sm opacity-80">Rundown</div>
                  <ul className="mt-2 list-disc pl-5 grid gap-1">
                    {result.prepack.rundown.map((s) => (
                      <li key={`${s.segment}-${s.minutes}`}>
                        <span className="font-semibold">{s.segment}</span>{" "}
                        <span className="opacity-80">({s.minutes}m)</span> — {s.goal}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={subCard}>
                  <div className="text-sm opacity-80">Pertanyaan</div>
                  <ol className="mt-2 list-decimal pl-5 grid gap-3">
                    {result.prepack.questions.map((qItem) => (
                      <li key={qItem.q}>
                        <div className="font-semibold">{qItem.q}</div>
                        <ul className="mt-1 list-disc pl-5 opacity-90 grid gap-1">
                          {qItem.followups.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className={subCard}>
                  <div className="text-sm opacity-80">Moment targets</div>
                  <ul className="mt-2 list-disc pl-5 grid gap-1">
                    {result.prepack.moment_targets.map((m) => (
                      <li key={`${m.label}-${m.where}`}>
                        <span className="font-semibold">{m.label}</span>{" "}
                        <span className="opacity-80">({m.where})</span> — {m.why}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={subCard}>
                  <div className="text-sm opacity-80">Closing CTA</div>
                  <p className="mt-1 whitespace-pre-wrap">{result.prepack.closing_cta}</p>
                </div>

                <div className={subCard}>
                  <div className="text-sm opacity-80">Markdown (siap copy-paste)</div>
                  <pre className="mt-2 whitespace-pre-wrap overflow-x-auto text-sm">
                    {result.markdown}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sticky action bar (mobile) */}
      <div className={stickyBar}>
        {activeTab === "input" ? (
          <button
            type="button"
            className={`${btnPrimary} w-full py-3`}
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate PRE Pack"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" className={`${btnGhost} flex-1 py-3`} onClick={onCopyMarkdown}>
              Copy Markdown
            </button>
            <button type="button" className={`${btnGhost} flex-1 py-3`} onClick={onCopyJson}>
              Copy JSON
            </button>
          </div>
        )}
      </div>
    </main>
  );
}