/**
 * CartRover API client
 * Handles Basic Auth, base URL, and error normalisation.
 */

const BASE_URL = 'https://api.cartrover.com';

function getAuthHeader() {
  const user = process.env.CARTROVER_USER;
  const key  = process.env.CARTROVER_KEY;
  if (!user || !key) throw new Error('Missing CARTROVER_USER or CARTROVER_KEY env vars');
  return 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64');
}

/**
 * Make a request to the CartRover API.
 * @param {string} path    - e.g. '/v1/merchant/orders'
 * @param {object} options - fetch options (method, body, etc.)
 * @returns {Promise<any>} Parsed JSON response
 */
async function cartrover(path, options = {}) {
  const { default: fetch } = await import('node-fetch');

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const msg = data?.message || `CartRover error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.errorCode = data?.error_code;
    throw err;
  }

  return data;
}

module.exports = { cartrover };
