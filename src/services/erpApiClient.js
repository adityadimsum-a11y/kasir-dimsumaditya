const getApiUrl = () => {
  const localOverride = typeof window !== 'undefined'
    ? window.localStorage.getItem('dimsum_new_erp_api_url')
    : '';

  return (
    localOverride ||
    import.meta.env.VITE_ERP_API_URL ||
    import.meta.env.VITE_GAS_API_URL ||
    ''
  ).trim();
};

const normalizeResponse = (result) => {
  if (!result) {
    return {
      success: false,
      message: 'Response kosong dari mesin baru.',
      data: null,
    };
  }

  if (result.success === true || result.status === 'success') {
    return {
      success: true,
      message: result.message || 'Berhasil.',
      data: result.data ?? result,
      meta: result.meta || {},
      raw: result,
    };
  }

  return {
    success: false,
    message: result.message || result.error?.message || 'Request ditolak mesin baru.',
    data: result.data || null,
    error: result.error || null,
    raw: result,
  };
};

export async function apiRequest(action, payload = {}, sessionToken = '') {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return {
      success: false,
      message: 'URL backend baru belum diset. Isi VITE_ERP_API_URL di .env atau localStorage dimsum_new_erp_api_url.',
      data: null,
      error: {
        code: 'MISSING_API_URL',
      },
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action,
        payload,
        sessionToken,
        session_token: sessionToken,
      }),
    });

    const text = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return {
        success: false,
        message: 'Response backend baru bukan JSON valid.',
        data: null,
        error: {
          code: 'INVALID_JSON_RESPONSE',
          raw: text,
        },
      };
    }

    return normalizeResponse(parsed);
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Koneksi backend baru gagal.',
      data: null,
      error: {
        code: 'FETCH_ERROR',
      },
    };
  }
}

export async function loginBridge({ username, password }) {
  const result = await apiRequest('login', { username, password }, '');

  if (!result.success) {
    return result;
  }

  const payload = result.data || {};
  const user = payload.user || {};
  const sessionToken = payload.session_token || payload.sessionToken || '';
  const roleId = String(user.role_id || '').toUpperCase();
  const roleName = String(user.role_name || '').toUpperCase();
  const isOwner = roleId.includes('OWNER') || roleName.includes('OWNER') || roleName.includes('SUPER');

  return {
    success: true,
    message: result.message || 'Login berhasil.',
    sessionToken,
    allowedMenus: payload.allowed_menus || [],
    user: {
      ...user,
      id: user.user_id || user.id || user.username,
      name: user.display_name || user.full_name || user.name || user.username,
      role: user.role_name || user.role_id || 'USER',
      branch_id: user.location_id || user.branch_id || 'LOC-TGR',
      branch_name: user.location_name || user.branch_name || 'Tangerang HO',
      branch_type: isOwner ? 'HQ_FACTORY' : (user.branch_type || 'BRANCH'),
      location_id: user.location_id || user.branch_id || '',
      location_name: user.location_name || user.branch_name || '',
      session_token: sessionToken,
      sessionToken,
    },
    raw: result.raw,
  };
}

export async function getLegacyBootstrap(sessionToken, payload = {}) {
  return apiRequest('getLegacyBootstrap', payload, sessionToken);
}

export async function getLegacyDashboard(sessionToken, payload = {}) {
  return apiRequest('getLegacyDashboard', payload, sessionToken);
}

export async function getLegacyBranchMonitoring(sessionToken, payload = {}) {
  return apiRequest('getLegacyBranchMonitoring', payload, sessionToken);
}

export function getConfiguredApiUrl() {
  return getApiUrl();
}
