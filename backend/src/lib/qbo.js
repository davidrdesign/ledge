/**
 * QuickBooks Online API client
 * Handles OAuth 2.0, automatic token refresh, and SSM token storage.
 */

const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

const QBO_BASE        = process.env.QBO_SANDBOX === 'true'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';
const TOKEN_URL       = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const MINOR_VERSION   = '75';

// SSM parameter paths
const SSM = {
  accessToken:  '/ledge/qbo/access_token',
  refreshToken: '/ledge/qbo/refresh_token',
  realmId:      '/ledge/qbo/realm_id',
  expiry:       '/ledge/qbo/token_expiry',
};

// ── SSM helpers ──────────────────────────────────────────────────────────────

async function getParam(name) {
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    return res.Parameter.Value;
  } catch (e) {
    if (e.name === 'ParameterNotFound') return null;
    throw e;
  }
}

async function putParam(name, value, type = 'SecureString') {
  await ssm.send(new PutParameterCommand({ Name: name, Value: value, Type: type, Overwrite: true }));
}

// ── Token management ─────────────────────────────────────────────────────────

async function loadTokens() {
  const [accessToken, refreshToken, realmId, expiry] = await Promise.all([
    getParam(SSM.accessToken),
    getParam(SSM.refreshToken),
    getParam(SSM.realmId),
    getParam(SSM.expiry),
  ]);
  return { accessToken, refreshToken, realmId, expiry: expiry ? parseInt(expiry, 10) : 0 };
}

async function saveTokens({ accessToken, refreshToken, realmId }) {
  const expiry = Date.now() + 55 * 60 * 1000; // 55 min (1 hour minus buffer)
  await Promise.all([
    putParam(SSM.accessToken,  accessToken),
    putParam(SSM.refreshToken, refreshToken),
    putParam(SSM.expiry,       String(expiry), 'String'),
    ...(realmId ? [putParam(SSM.realmId, realmId, 'String')] : []),
  ]);
  return { accessToken, refreshToken, realmId, expiry };
}

async function refreshAccessToken(refreshToken) {
  const { default: fetch } = await import('node-fetch');
  const creds = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function getValidToken() {
  let tokens = await loadTokens();
  if (!tokens.refreshToken) throw new Error('QuickBooks not connected. Visit /qbo/auth to connect.');

  const needsRefresh = !tokens.accessToken || Date.now() >= tokens.expiry;
  if (needsRefresh) {
    const fresh = await refreshAccessToken(tokens.refreshToken);
    tokens = await saveTokens({
      accessToken:  fresh.access_token,
      refreshToken: fresh.refresh_token,
      realmId:      tokens.realmId,
    });
  }
  return tokens;
}

// ── Public API request helper ─────────────────────────────────────────────────

/**
 * Make an authenticated request to the QBO API.
 * @param {string} path   - e.g. '/query?query=SELECT * FROM Invoice'
 * @param {object} opts   - fetch options
 * @returns {Promise<any>}
 */
async function qbo(path, opts = {}) {
  const { default: fetch } = await import('node-fetch');
  const { accessToken, realmId } = await getValidToken();

  const url = `${QBO_BASE}/v3/company/${realmId}${path}${path.includes('?') ? '&' : '?'}minorversion=${MINOR_VERSION}`;

  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const msg = data?.Fault?.Error?.[0]?.Message || `QBO error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.fault  = data?.Fault;
    throw err;
  }
  return data;
}

// ── OAuth exchange (called from callback handler) ─────────────────────────────

async function exchangeCodeForTokens(code, realmId, redirectUri) {
  const { default: fetch } = await import('node-fetch');
  const creds = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  const tokens = await res.json();
  await saveTokens({
    accessToken:  tokens.access_token,
    refreshToken: tokens.refresh_token,
    realmId,
  });
  return tokens;
}

module.exports = { qbo, exchangeCodeForTokens, loadTokens, saveTokens };
