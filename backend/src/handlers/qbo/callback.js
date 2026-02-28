/**
 * GET /qbo/callback
 * Intuit redirects here after the user authorizes.
 * Exchanges the auth code for tokens, stores them in SSM,
 * then redirects the browser back to the app.
 */

const { exchangeCodeForTokens } = require('../../lib/qbo');

module.exports.handler = async (event) => {
  const { code, realmId, error } = event.queryStringParameters || {};
  const appUrl = process.env.APP_URL || 'http://localhost:3456/inventory-app.html';

  if (error) {
    console.error('OAuth error from Intuit:', error);
    return {
      statusCode: 302,
      headers: { Location: `${appUrl}?qbo_error=${encodeURIComponent(error)}` },
      body: '',
    };
  }

  if (!code || !realmId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing code or realmId' }),
    };
  }

  try {
    await exchangeCodeForTokens(code, realmId, process.env.QBO_REDIRECT_URI);
    return {
      statusCode: 302,
      headers: { Location: `${appUrl}?qbo_connected=1` },
      body: '',
    };
  } catch (err) {
    console.error('Token exchange error:', err);
    return {
      statusCode: 302,
      headers: { Location: `${appUrl}?qbo_error=${encodeURIComponent(err.message)}` },
      body: '',
    };
  }
};
