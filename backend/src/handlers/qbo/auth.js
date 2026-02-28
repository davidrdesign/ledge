/**
 * GET /qbo/auth
 * Redirects the browser to Intuit's OAuth 2.0 authorization page.
 */

const CORS = { 'Access-Control-Allow-Origin': '*' };

module.exports.handler = async () => {
  const clientId     = process.env.QBO_CLIENT_ID;
  const redirectUri  = process.env.QBO_REDIRECT_URI;
  const scope        = 'com.intuit.quickbooks.accounting';
  const state        = Math.random().toString(36).slice(2);

  if (!clientId || !redirectUri) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'QBO_CLIENT_ID or QBO_REDIRECT_URI not configured' }),
    };
  }

  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
  authUrl.searchParams.set('client_id',     clientId);
  authUrl.searchParams.set('scope',         scope);
  authUrl.searchParams.set('redirect_uri',  redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state',         state);

  return {
    statusCode: 302,
    headers: { ...CORS, Location: authUrl.toString() },
    body: '',
  };
};
