import { useState } from "react";
import { APP_BRAND } from "../../config/theme.config";
import { loginUser, getConfiguredApiUrl } from "../../lib/api/actions";

const LOGIN_STYLES = String.raw`.da-auth-page {
  --auth-red: #d92920;
  --auth-red-dark: #b91f18;
  --auth-gold: #f6b51e;
  --auth-gold-soft: #fff2c9;
  --auth-ink: #15171b;
  --auth-muted: #667085;
  --auth-border: #e5e7eb;
  --auth-surface: rgba(255, 255, 255, 0.96);

  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 48px 24px 76px;
  background:
    radial-gradient(circle at 12% 16%, rgba(246, 181, 30, 0.16), transparent 26%),
    radial-gradient(circle at 91% 15%, rgba(217, 41, 32, 0.07), transparent 24%),
    linear-gradient(135deg, #fffdf8 0%, #fffaf0 48%, #fffefd 100%);
  color: var(--auth-ink);
}

.da-auth-page::before,
.da-auth-page::after {
  content: "";
  position: absolute;
  z-index: -2;
  border: 1px solid rgba(246, 181, 30, 0.2);
  border-radius: 50%;
  pointer-events: none;
}

.da-auth-page::before {
  width: 460px;
  height: 460px;
  left: -270px;
  bottom: -190px;
  box-shadow:
    0 0 0 38px rgba(246, 181, 30, 0.035),
    0 0 0 78px rgba(246, 181, 30, 0.025);
}

.da-auth-page::after {
  width: 420px;
  height: 420px;
  right: -230px;
  top: -130px;
  box-shadow:
    0 0 0 34px rgba(246, 181, 30, 0.03),
    0 0 0 72px rgba(246, 181, 30, 0.02);
}

.da-auth-card {
  position: relative;
  z-index: 2;
  width: min(100%, 540px);
  padding: 42px 44px 28px;
  border: 1px solid rgba(229, 231, 235, 0.92);
  border-radius: 28px;
  background: var(--auth-surface);
  box-shadow:
    0 30px 80px rgba(20, 24, 32, 0.12),
    0 8px 24px rgba(20, 24, 32, 0.06);
  backdrop-filter: blur(18px);
}

.da-auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.da-auth-logo-wrap {
  width: 94px;
  height: 94px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(246, 181, 30, 0.55);
  box-shadow:
    0 12px 28px rgba(20, 24, 32, 0.08),
    inset 0 0 0 5px rgba(246, 181, 30, 0.08);
  overflow: hidden;
}

.da-auth-logo {
  display: block;
  width: 82px;
  height: 82px;
  object-fit: contain;
}

.da-auth-logo-fallback {
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--auth-red), var(--auth-red-dark));
  color: #fff;
  font-weight: 900;
  font-size: 24px;
}

.da-auth-title {
  margin: 0;
  font-size: clamp(34px, 5vw, 46px);
  line-height: 1.04;
  letter-spacing: -0.055em;
  color: var(--auth-ink);
}

.da-auth-title strong {
  color: var(--auth-red);
}

.da-auth-tagline {
  margin: 12px 0 0;
  color: var(--auth-muted);
  font-size: 17px;
  font-weight: 600;
}

.da-auth-credit {
  margin: 7px 0 0;
  color: #333942;
  font-size: 14px;
  font-weight: 600;
}

.da-auth-credit strong {
  color: var(--auth-red);
}

.da-auth-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin: 28px 0 24px;
}

.da-auth-divider > span {
  height: 1px;
  background: linear-gradient(90deg, transparent, #d9dde4);
}

.da-auth-divider > span:last-child {
  background: linear-gradient(90deg, #d9dde4, transparent);
}

.da-auth-divider-mark {
  width: 32px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--auth-gold-soft);
  color: #ad7600;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.04em;
  box-shadow: inset 0 0 0 1px rgba(246, 181, 30, 0.26);
}

.da-auth-form {
  display: grid;
  gap: 18px;
}

.da-auth-field {
  display: grid;
  gap: 8px;
}

.da-auth-label {
  color: #252a32;
  font-weight: 800;
  font-size: 14px;
}

.da-auth-input-shell {
  min-height: 56px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  border: 1px solid #d7dce4;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(20, 24, 32, 0.025);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
  overflow: hidden;
}

.da-auth-input-shell:focus-within {
  border-color: rgba(217, 41, 32, 0.65);
  box-shadow:
    0 0 0 4px rgba(217, 41, 32, 0.09),
    0 8px 20px rgba(20, 24, 32, 0.05);
  transform: translateY(-1px);
}

.da-auth-input-icon {
  width: 48px;
  height: 100%;
  display: grid;
  place-items: center;
  color: #5f6774;
  background: linear-gradient(180deg, #fbfcfd, #f7f8fa);
  border-right: 1px solid #edf0f3;
}

.da-auth-input-icon svg,
.da-auth-password-toggle svg,
.da-auth-shield svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.da-auth-input-shell input {
  width: 100%;
  min-width: 0;
  height: 54px;
  padding: 0 14px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--auth-ink);
  font-size: 15px;
  font-weight: 650;
}

.da-auth-input-shell input::placeholder {
  color: #98a2b3;
  font-weight: 500;
}

.da-auth-input-shell input:disabled {
  color: #7b8491;
  background: #fbfbfc;
}

.da-auth-password-toggle {
  width: 48px;
  height: 54px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #667085;
  transition: color 150ms ease, background 150ms ease;
}

.da-auth-password-toggle:hover:not(:disabled),
.da-auth-password-toggle:focus-visible {
  color: var(--auth-red);
  background: rgba(217, 41, 32, 0.045);
  outline: 0;
}

.da-auth-error {
  padding: 12px 14px;
  border: 1px solid #f4b4ae;
  border-radius: 12px;
  background: #fff1f0;
  color: #a91d16;
  font-size: 13px;
  font-weight: 700;
}

.da-auth-submit {
  min-height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 0 22px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #e0251b 0%, #c91f17 100%);
  color: #fff;
  box-shadow:
    0 12px 24px rgba(201, 31, 23, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  font-size: 16px;
  font-weight: 900;
  letter-spacing: -0.01em;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease;
}

.da-auth-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    0 16px 30px rgba(201, 31, 23, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  filter: saturate(1.04);
}

.da-auth-submit:active:not(:disabled) {
  transform: translateY(0);
}

.da-auth-submit:focus-visible {
  outline: 4px solid rgba(217, 41, 32, 0.15);
  outline-offset: 3px;
}

.da-auth-submit:disabled {
  opacity: 0.7;
  cursor: wait;
}

.da-auth-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.42);
  border-top-color: #fff;
  border-radius: 50%;
  animation: da-auth-spin 750ms linear infinite;
}

@keyframes da-auth-spin {
  to {
    transform: rotate(360deg);
  }
}

.da-auth-system-copy {
  margin-top: 22px;
  text-align: center;
}

.da-auth-system-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #343a45;
  font-size: 14px;
  font-weight: 850;
}

.da-auth-shield {
  display: inline-grid;
  place-items: center;
  color: #e8a400;
}

.da-auth-shield svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.da-auth-system-copy p {
  margin: 5px 0 0;
  color: var(--auth-muted);
  font-size: 13px;
}

.da-auth-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e3e6eb;
  color: #5b6470;
  font-size: 12px;
  font-weight: 650;
}

.da-auth-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(20, 184, 79, 0.08);
}

.da-auth-status-dot.is-ready {
  background: #16a34a;
}

.da-auth-status-dot.is-warning {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1);
}

.da-auth-orb,
.da-auth-dot-grid,
.da-auth-steam,
.da-auth-bottom-wave {
  position: absolute;
  pointer-events: none;
  user-select: none;
}

.da-auth-orb {
  z-index: -1;
  border-radius: 50%;
  opacity: 0.7;
}

.da-auth-orb-left {
  width: 180px;
  height: 180px;
  left: 4%;
  bottom: 15%;
  border: 1px solid rgba(246, 181, 30, 0.18);
  background:
    radial-gradient(circle at 42% 38%, rgba(246, 181, 30, 0.09) 0 16%, transparent 17%),
    repeating-radial-gradient(circle at 50% 50%, rgba(246, 181, 30, 0.07) 0 2px, transparent 3px 18px);
}

.da-auth-orb-right {
  width: 230px;
  height: 230px;
  right: 2.5%;
  top: 16%;
  border: 1px solid rgba(246, 181, 30, 0.16);
  background:
    repeating-linear-gradient(45deg, rgba(246, 181, 30, 0.035) 0 1px, transparent 1px 18px),
    repeating-linear-gradient(-45deg, rgba(246, 181, 30, 0.03) 0 1px, transparent 1px 18px);
}

.da-auth-dot-grid {
  width: 68px;
  height: 68px;
  opacity: 0.58;
  background-image: radial-gradient(circle, rgba(246, 181, 30, 0.7) 0 4px, transparent 4.5px);
  background-size: 22px 22px;
}

.da-auth-dot-grid-top {
  left: 3%;
  top: 4%;
}

.da-auth-dot-grid-bottom {
  right: 4%;
  bottom: 9%;
}

.da-auth-steam {
  z-index: -1;
  width: 42px;
  height: 190px;
  border-radius: 50%;
  border-left: 12px solid rgba(246, 181, 30, 0.075);
  transform: rotate(10deg);
}

.da-auth-steam-left {
  left: 9%;
  top: 23%;
}

.da-auth-steam-right {
  right: 12%;
  bottom: 21%;
  transform: rotate(-12deg) scale(0.72);
}

.da-auth-bottom-wave {
  z-index: 0;
  left: -3%;
  right: -3%;
  bottom: -56px;
  height: 92px;
  border-top: 8px solid var(--auth-gold);
  border-radius: 50% 50% 0 0 / 45% 45% 0 0;
  background: linear-gradient(90deg, #cd2018 0%, #ec261d 48%, #bd1d16 100%);
  transform: rotate(-1.2deg);
  box-shadow: 0 -4px 14px rgba(246, 181, 30, 0.09);
}

@media (max-width: 900px) {
  .da-auth-orb-right,
  .da-auth-orb-left,
  .da-auth-steam {
    opacity: 0.45;
  }
}

@media (max-width: 640px) {
  .da-auth-page {
    align-items: start;
    min-height: 100svh;
    padding: 24px 14px 70px;
  }

  .da-auth-card {
    width: 100%;
    padding: 30px 20px 22px;
    border-radius: 22px;
  }

  .da-auth-logo-wrap {
    width: 80px;
    height: 80px;
    margin-bottom: 14px;
  }

  .da-auth-logo {
    width: 70px;
    height: 70px;
  }

  .da-auth-title {
    font-size: 34px;
  }

  .da-auth-tagline {
    font-size: 15px;
  }

  .da-auth-divider {
    margin: 23px 0 20px;
  }

  .da-auth-orb,
  .da-auth-steam {
    display: none;
  }

  .da-auth-dot-grid {
    opacity: 0.32;
    transform: scale(0.76);
  }
}

@media (max-height: 760px) and (min-width: 641px) {
  .da-auth-page {
    padding-top: 24px;
    padding-bottom: 60px;
  }

  .da-auth-card {
    padding-top: 28px;
    padding-bottom: 20px;
  }

  .da-auth-logo-wrap {
    width: 78px;
    height: 78px;
    margin-bottom: 12px;
  }

  .da-auth-logo {
    width: 68px;
    height: 68px;
  }

  .da-auth-divider {
    margin-top: 20px;
    margin-bottom: 18px;
  }

  .da-auth-system-copy {
    margin-top: 17px;
  }

  .da-auth-footer {
    margin-top: 17px;
    padding-top: 15px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .da-auth-input-shell,
  .da-auth-submit {
    transition: none;
  }

  .da-auth-spinner {
    animation-duration: 1.5s;
  }
}
`;

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
      <style>{LOGIN_STYLES}</style>
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
