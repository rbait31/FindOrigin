"use client";

import { useState, useEffect } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        close: () => void;
        MainButton?: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (fn: () => void) => void;
          showProgress: (show: boolean) => void;
        };
      };
    };
  }
}

interface Source {
  url: string;
  title: string;
  confidence: string;
}

interface AnalyzeResponse {
  summary?: string | null;
  sources: Source[];
  message?: string;
  error?: string;
}

export default function MiniPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    if (tg) {
      tg.ready();
      tg.expand?.();
      tg.setHeaderColor?.("#3390ec");
      tg.setBackgroundColor?.("#f4f4f5");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!text.trim() || text.trim().length < 10) {
      setError("Введите текст не менее 10 символов");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data: AnalyzeResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка при анализе");
        return;
      }
      setResult(data);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "16px",
        paddingBottom: "24px",
        minHeight: "100vh",
        background: "#f4f4f5",
      }}
    >
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 600,
          margin: "0 0 8px",
          color: "#000",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "24px" }}>🔍</span> Find Truth
      </h1>
      <p style={{ fontSize: "14px", color: "#6d6d72", margin: "0 0 20px" }}>
        Проверка источников информации
      </p>

      <form onSubmit={handleSubmit}>
        <label
          htmlFor="text-input"
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            color: "#000",
            marginBottom: "8px",
          }}
        >
          Введите текст для проверки:
        </label>
        <textarea
          id="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: Илон Маск планирует полет на Марс"
          disabled={loading}
          style={{
            width: "100%",
            minHeight: "120px",
            padding: "12px",
            fontSize: "15px",
            border: "1px solid #e5e5ea",
            borderRadius: "12px",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "12px",
            width: "100%",
            padding: "14px",
            fontSize: "16px",
            fontWeight: 600,
            color: "#fff",
            background: loading ? "#94b8e0" : "#3390ec",
            border: "none",
            borderRadius: "12px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Анализирую…" : "Анализировать"}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            background: "#ffebee",
            color: "#c62828",
            borderRadius: "12px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {result && !error && (
        <div style={{ marginTop: "20px" }}>
          {result.summary && (
            <section style={{ marginBottom: "20px" }}>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: "0 0 8px",
                  color: "#000",
                }}
              >
                Резюме
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.5,
                  color: "#333",
                  margin: 0,
                  background: "#fff",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #e5e5ea",
                }}
              >
                {result.summary}
              </p>
            </section>
          )}

          {result.sources.length > 0 && (
            <section>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: "0 0 12px",
                  color: "#000",
                }}
              >
                Источники
              </h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {result.sources.map((s, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: "10px",
                      background: "#fff",
                      borderRadius: "12px",
                      border: "1px solid #e5e5ea",
                      overflow: "hidden",
                    }}
                  >
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        padding: "12px",
                        color: "#3390ec",
                        textDecoration: "none",
                        fontSize: "14px",
                      }}
                    >
                      <strong style={{ color: "#000" }}>{s.title}</strong>
                      {s.confidence && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "12px",
                            color: "#6d6d72",
                            marginTop: "4px",
                          }}
                        >
                          Уверенность: {s.confidence}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.message && !result.summary && result.sources.length === 0 && (
            <p style={{ fontSize: "14px", color: "#6d6d72" }}>{result.message}</p>
          )}
        </div>
      )}
    </main>
  );
}
