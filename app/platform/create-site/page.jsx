// app/platform/create-site/page.jsx
"use client";

import { useState, useEffect } from "react";
import { createSite, cancelVerification } from "@/lib/actions/site-management.actions";
import { useSearchParams } from "next/navigation";

export default function CreateSitePage() {
  const searchParams = useSearchParams();
  
  // pending?status=pending&siteId=xxx&domain=xxx comes from verification gate redirect
  const statusParam = searchParams.get("status");
  const siteIdParam = searchParams.get("siteId");
  const domainParam = searchParams.get("domain");

  const [domain, setDomain] = useState("");
  const [specifyForm, setSpecifyForm] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // If redirected here with pending status, show pending UI immediately
  const showPendingFromParam = statusParam === "pending" && siteIdParam && domainParam;

  const handleSubmit = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await createSite({
        name: domain.trim(),
        domain: domain.trim(),
        specify_form: specifyForm,
      });
      setResult(res);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelVerification = async (siteId) => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelVerification(siteId);
      if (res.success) {
        // Redirect to create-site fresh so they can start over or see empty state
        window.location.href = "/platform/create-site";
      } else {
        setCancelError(res.error);
      }
    } catch (err) {
      setCancelError(err.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  // ── PENDING STATE (redirected from verification gate) ────────────────────
  if (showPendingFromParam) {
    return (
      <div style={containerStyle}>
        <PendingUI
          domain={domainParam}
          siteId={siteIdParam}
          onCancel={handleCancelVerification}
          cancelling={cancelling}
          cancelError={cancelError}
        />
      </div>
    );
  }

  // ── PLAN LIMIT REACHED ───────────────────────────────────────────────────
  if (result?.planLimitReached) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ color: "#f59e0b", fontSize: 28, marginBottom: 12 }}>⚠</div>
          <h2 style={headingStyle}>Site Limit Reached</h2>
          <p style={bodyStyle}>
            Your current plan only allows <strong>1 site</strong>. Upgrade to{" "}
            <strong>Elite</strong> to manage multiple sites.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <a href="/platform/billing" style={primaryBtnStyle}>
              Upgrade to Elite
            </a>
            <a href="/platform" style={secondaryBtnStyle}>
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── DOMAIN ALREADY EXISTS (no access) ───────────────────────────────────
  if (result?.alreadyExists) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ color: "#f59e0b", fontSize: 28, marginBottom: 12 }}>⚠</div>
          <h2 style={headingStyle}>Domain Already Registered</h2>
          <p style={bodyStyle}>
            <strong>{result.site.domain}</strong> is already registered. Your email
            doesn't match this domain. Ask the site owner to invite you from their
            Settings page.
          </p>
          <button
            onClick={() => { setResult(null); setDomain(""); }}
            style={secondaryBtnStyle}
          >
            Try a different domain
          </button>
        </div>
      </div>
    );
  }

  // ── AUTO-JOINED VIA EMAIL DOMAIN MATCH ──────────────────────────────────
  if (result?.joined) {
    const script = `<script src="${process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000"}/tracker.js" data-key="${result.site.api_key}"></script>`;
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ color: "#4ade80", fontSize: 28, marginBottom: 12 }}>✅</div>
          <h2 style={headingStyle}>Joined Existing Site</h2>
          <p style={bodyStyle}>
            Your email matched <strong>{result.site.domain}</strong> — you've been
            added automatically. The tracker is already installed.
          </p>
          <pre style={preStyle}>{script}</pre>
          <a href="/platform" style={primaryBtnStyle}>Go to Dashboard →</a>
        </div>
      </div>
    );
  }

  // ── ALREADY A MEMBER ─────────────────────────────────────────────────────
  if (result?.alreadyMember) {
    const script = result.site?.api_key
      ? `<script src="${process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000"}/tracker.js" data-key="${result.site.api_key}"></script>`
      : null;
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ color: "#60a5fa", fontSize: 28, marginBottom: 12 }}>ℹ</div>
          <h2 style={headingStyle}>You Already Have Access</h2>
          <p style={bodyStyle}>
            You already have access to <strong>{result.site.domain}</strong>.
          </p>
          {script && <pre style={preStyle}>{script}</pre>}
          <a href="/platform" style={primaryBtnStyle}>Go to Dashboard →</a>
        </div>
      </div>
    );
  }

  // ── RECLAIMED (unverified, original owner) ───────────────────────────────
  if (result?.reclaimed) {
    const script = `<script src="${process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000"}/tracker.js" data-key="${result.site.api_key}"></script>`;
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ color: "#4ade80", fontSize: 28, marginBottom: 12 }}>✅</div>
          <h2 style={headingStyle}>Site Reclaimed</h2>
          <p style={bodyStyle}>
            You previously registered <strong>{result.site.domain}</strong> but never
            installed the script. Your API key is unchanged.
          </p>
          <p style={labelStyle}>
            Paste before your closing <code style={codeStyle}>&lt;/body&gt;</code>:
          </p>
          <pre style={preStyle}>{script}</pre>
          {result.site.specify_form && (
            <>
              <p style={labelStyle}>Add to your conversion form:</p>
              <pre style={preStyle}>{`<form data-conversion="true">\n  ...\n</form>`}</pre>
            </>
          )}
          <a href="/platform" style={primaryBtnStyle}>Go to Dashboard →</a>
        </div>
      </div>
    );
  }

  // ── NEW SITE CREATED — show pending verification UI ──────────────────────
  if (result?.site && !result.joined) {
    return (
      <div style={containerStyle}>
        <PendingUI
          domain={result.site.domain}
          siteId={result.site.id}
          apiKey={result.site.api_key}
          specifyForm={specifyForm}
          onCancel={handleCancelVerification}
          cancelling={cancelling}
          cancelError={cancelError}
        />
      </div>
    );
  }

  // ── DEFAULT: Registration form ───────────────────────────────────────────
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Add Your Site</h1>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Your domain</label>
          <input
            placeholder="yourdomain.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={inputStyle}
          />
          <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
            Without https:// or www
          </p>
        </div>

        <div style={sectionBoxStyle}>
          <p style={{ ...labelStyle, marginBottom: 4 }}>
            Do you have a specific conversion form?
          </p>
          <p style={{ color: "#555", fontSize: 11, marginBottom: 12 }}>
            A contact form, demo request, or sign-up — not a search bar or newsletter.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setSpecifyForm(false)}
              style={!specifyForm ? activePillStyle : pillStyle}
            >
              No — track all forms
            </button>
            <button
              onClick={() => setSpecifyForm(true)}
              style={specifyForm ? activePillStyle : pillStyle}
            >
              Yes — I'll label my form
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !domain.trim()}
          style={{ ...primaryBtnStyle, opacity: loading || !domain.trim() ? 0.5 : 1 }}
        >
          {loading ? "Checking..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PendingUI — shown after site creation OR when redirected from gated pages
// Shows script to install, pending badge, and cancel button
// ─────────────────────────────────────────────────────────────────────────────
function PendingUI({ domain, siteId, apiKey, specifyForm, onCancel, cancelling, cancelError }) {
  const trackerBase = process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000";
  const script = apiKey
    ? `<script src="${trackerBase}/tracker.js" data-key="${apiKey}"></script>`
    : null;

  return (
    <div style={cardStyle}>
      {/* Status badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={pendingBadgeStyle}>● PENDING VERIFICATION</span>
      </div>

      <h2 style={headingStyle}>{domain}</h2>
      <p style={bodyStyle}>
        Waiting for the first tracker hit from your site. Once the script loads on your
        site, your dashboard will activate automatically.
      </p>

      {/* Animated waiting indicator */}
      <div style={waitingBoxStyle}>
        <div style={{ color: "#555", fontSize: 12, marginBottom: 8 }}>
          Listening for connection...
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#4ade80",
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Script install instructions */}
      {script && (
        <div style={{ marginTop: 20 }}>
          <p style={labelStyle}>
            Step 1 — Paste before your closing{" "}
            <code style={codeStyle}>&lt;/body&gt;</code> tag:
          </p>
          <pre style={preStyle}>{script}</pre>
        </div>
      )}

      {specifyForm && (
        <div style={{ marginTop: 16 }}>
          <p style={labelStyle}>Step 2 — Add to your conversion form:</p>
          <pre style={preStyle}>{`<form data-conversion="true">\n  ...\n</form>`}</pre>
        </div>
      )}

      {/* Cancel option */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1a1a1a" }}>
        <p style={{ color: "#444", fontSize: 11, marginBottom: 12 }}>
          Registered the wrong domain? You can cancel and start over.
        </p>
        {cancelError && (
          <p style={{ color: "#f87171", fontSize: 11, marginBottom: 8 }}>{cancelError}</p>
        )}
        <button
          onClick={() => onCancel(siteId)}
          disabled={cancelling}
          style={{
            ...secondaryBtnStyle,
            borderColor: "#7f1d1d",
            color: "#f87171",
            opacity: cancelling ? 0.5 : 1,
          }}
        >
          {cancelling ? "Cancelling..." : "Cancel & Start Over"}
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "#0a0a0a",
};

const cardStyle = {
  background: "#111",
  border: "1px solid #1a1a1a",
  borderRadius: 12,
  padding: 32,
  maxWidth: 480,
  width: "100%",
  fontFamily: "monospace",
};

const headingStyle = {
  color: "#fff",
  fontSize: 20,
  fontWeight: "bold",
  marginBottom: 12,
  margin: 0,
  marginBottom: 12,
};

const bodyStyle = {
  color: "#888",
  fontSize: 13,
  lineHeight: 1.6,
  marginBottom: 20,
};

const labelStyle = {
  color: "#aaa",
  fontSize: 12,
  marginBottom: 8,
  display: "block",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  color: "#fff",
  fontSize: 13,
  fontFamily: "monospace",
  boxSizing: "border-box",
};

const preStyle = {
  background: "#0a0a0a",
  border: "1px solid #1a1a1a",
  borderRadius: 6,
  padding: "12px 14px",
  fontSize: 11,
  color: "#4ade80",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  marginBottom: 16,
};

const codeStyle = {
  background: "#1a1a1a",
  padding: "1px 5px",
  borderRadius: 3,
  fontSize: 11,
};

const primaryBtnStyle = {
  display: "inline-block",
  padding: "10px 20px",
  background: "#4ade80",
  color: "#000",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  textDecoration: "none",
  fontFamily: "monospace",
};

const secondaryBtnStyle = {
  display: "inline-block",
  padding: "10px 20px",
  background: "transparent",
  color: "#888",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "none",
  fontFamily: "monospace",
};

const activePillStyle = {
  padding: "8px 16px",
  background: "#4ade80",
  color: "#000",
  border: "1px solid #4ade80",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "monospace",
  fontWeight: "bold",
};

const pillStyle = {
  padding: "8px 16px",
  background: "transparent",
  color: "#888",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "monospace",
};

const sectionBoxStyle = {
  background: "#0a0a0a",
  border: "1px solid #1a1a1a",
  borderRadius: 8,
  padding: "16px",
  marginBottom: 20,
};

const pendingBadgeStyle = {
  background: "#f59e0b20",
  color: "#f59e0b",
  border: "1px solid #f59e0b40",
  borderRadius: 99,
  padding: "3px 12px",
  fontSize: 10,
  fontWeight: "bold",
  letterSpacing: 1,
};

const waitingBoxStyle = {
  background: "#0a0a0a",
  border: "1px solid #1a1a1a",
  borderRadius: 8,
  padding: 16,
  textAlign: "center",
  marginBottom: 4,
};