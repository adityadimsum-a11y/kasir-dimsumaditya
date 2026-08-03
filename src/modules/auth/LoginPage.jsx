import { useState } from "react";
import { APP_BRAND } from "../../config/theme.config";
import { loginUser, getConfiguredApiUrl } from "../../lib/api/actions";
import "./login.css";

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.25" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.25-5 9-5 9 5 9 5-3.25 5-9 5-9-5-9-5Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4 20 20" />
      <path d="M10.55 7.15A9.9 9.9 0 0 1 12 7c5.75 0 9 5 9 5a13.2 13.2 0 0 1-2.18 2.65" />
      <path d="M6.1 6.1C4.12 7.48 3 9.1 3 12c0 0 3.25 5 9 5a9.8 9.8 0 0 0 3.1-.48" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5.3c0 4.5-2.8 7.8-7 9.7-4.2-1.9-7-5.2-7-9.7V6l7-3Z" />
      <path d="m9.25 12 1.8 1.8 3.8-4" />
    </svg>
  );
}

export default function LoginPage({ onLoginSuccess }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const apiUrl = getConfiguredApiUrl();
  const backendReady = Boolean(String(apiUrl || "").trim());

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (message) {
      setMessage("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const username = form.username.trim();
    if (!username || !form.password) {
      setMessage("Username dan password wajib diisi.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await loginUser({
        username,
        password: form.password,
      });

      if (!result?.success) {
        setMessage(result?.message || "Login gagal. Periksa username dan password.");
        return;
      }

      onLoginSuccess(result.data);
    } catch (error) {
      setMessage(error?.message || "Koneksi login sedang bermasalah. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="da-auth-page">
      <div className="da-auth-orb da-auth-orb-left" aria-hidden="true" />
      <div className="da-auth-orb da-auth-orb-right" aria-hidden="true" />
      <div className="da-auth-dot-grid da-auth-dot-grid-top" aria-hidden="true" />
      <div className="da-auth-dot-grid da-auth-dot-grid-bottom" aria-hidden="true" />
      <div className="da-auth-steam da-auth-steam-left" aria-hidden="true" />
      <div className="da-auth-steam da-auth-steam-right" aria-hidden="true" />

      <section className="da-auth-card" aria-labelledby="da-auth-title">
        <header className="da-auth-brand">
          <div className="da-auth-logo-wrap">
            {APP_BRAND.logoUrl ? (
              <img
                className="da-auth-logo"
                src={APP_BRAND.logoUrl}
                alt={`Logo ${APP_BRAND.name}`}
              />
            ) : (
              <div className="da-auth-logo-fallback" aria-hidden="true">
                {APP_BRAND.shortName}
              </div>
            )}
          </div>

          <h1 id="da-auth-title" className="da-auth-title">
            <span>Dimsum</span> <strong>Aditya</strong>
          </h1>
          <p className="da-auth-tagline">Pabrik Dimsum Ayam Tangerang</p>
          <p className="da-auth-credit">
            by <strong>Dnamic Network</strong>
          </p>
        </header>

        <div className="da-auth-divider" aria-hidden="true">
          <span />
          <div className="da-auth-divider-mark">DA</div>
          <span />
        </div>

        <form onSubmit={handleSubmit} className="da-auth-form" noValidate>
          <label className="da-auth-field">
            <span className="da-auth-label">Username</span>
            <span className="da-auth-input-shell">
              <span className="da-auth-input-icon">
                <UserIcon />
              </span>
              <input
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                disabled={loading}
                aria-invalid={Boolean(message)}
              />
            </span>
          </label>

          <label className="da-auth-field">
            <span className="da-auth-label">Password</span>
            <span className="da-auth-input-shell">
              <span className="da-auth-input-icon">
                <LockIcon />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                disabled={loading}
                aria-invalid={Boolean(message)}
              />
              <button
                type="button"
                className="da-auth-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                disabled={loading}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </span>
          </label>

          {message ? (
            <div className="da-auth-error" role="alert" aria-live="polite">
              {message}
            </div>
          ) : null}

          <button type="submit" className="da-auth-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="da-auth-spinner" aria-hidden="true" />
                Memeriksa akun...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        <div className="da-auth-system-copy">
          <div className="da-auth-system-title">
            <span className="da-auth-shield">
              <ShieldIcon />
            </span>
            ERP Dimsum Aditya
          </div>
          <p>Masuk ke papan kerja usaha.</p>
        </div>

        <footer className="da-auth-footer">
          <span
            className={`da-auth-status-dot ${backendReady ? "is-ready" : "is-warning"}`}
            aria-hidden="true"
          />
          Backend: {backendReady ? "terpasang" : "belum diset"}
        </footer>
      </section>

      <div className="da-auth-bottom-wave" aria-hidden="true" />
    </main>
  );
}
