import { useState } from "react";
import { APP_BRAND } from "../../config/theme.config";
import { loginUser, getConfiguredApiUrl } from "../../lib/api/actions";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

export default function LoginPage({ onLoginSuccess }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const apiUrl = getConfiguredApiUrl();

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const result = await loginUser(form);

    setLoading(false);

    if (!result.success) {
      setMessage(result.message || "Login gagal.");
      return;
    }

    onLoginSuccess(result.data);
  };

  return (
    <div className="da-login-page">
      <Card className="da-login-card">
        <div className="da-login-brand">
          <div className="da-login-mark">
            {APP_BRAND.logoUrl ? (
              <img src={APP_BRAND.logoUrl} alt={APP_BRAND.name} />
            ) : (
              <strong>{APP_BRAND.shortName}</strong>
            )}
          </div>

          <div>
            <h1>{APP_BRAND.systemName}</h1>
            <p>Masuk ke papan kerja usaha.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="da-login-form">
          <label>
            Username
            <input
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="Masukkan password"
              autoComplete="current-password"
            />
          </label>

          {message ? <div className="da-login-error">{message}</div> : null}

          <Button type="submit" disabled={loading}>
            {loading ? "Masuk..." : "Masuk"}
          </Button>
        </form>

        <div className="da-login-api">
          Backend: {apiUrl ? "terpasang" : "belum diset"}
        </div>
      </Card>
    </div>
  );
}
