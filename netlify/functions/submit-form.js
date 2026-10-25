/**
 * Netlify Serverless Function: submit-form
 * Secure server-side proxy for GameManor Form Submissions to Google Apps Script.
 * 
 * Why this is necessary:
 * Browser-to-Google-Apps-Script POST requests trigger a CORS preflight (OPTIONS)
 * check when sending Content-Type: application/json. Google's infrastructure does
 * not return CORS headers on OPTIONS preflights, causing browser fetch to be blocked.
 * 
 * This server-side function receives the request from the browser on the same domain,
 * securely forwards it to the Google Apps Script endpoint with application/json,
 * follows the Google 302 redirect, and relays the exact response with standard CORS headers.
 */

const https = require('https');
const { URL } = require('url');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxLjK2_TOmdtoAzqydBT0kMl0bprIMF_ylnpquVvIocjDCxEXS-ZGSGPysOwLiVe04/exec';

function forwardToGoogleAppsScript(url, payloadString, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Too many redirects from Google Apps Script'));
    }

    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: redirectCount === 0 ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'GameManor-Web-Proxy/1.0'
      }
    };

    if (redirectCount === 0) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payloadString);
    }

    const req = https.request(options, (res) => {
      // Follow 301/302 redirects
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return resolve(forwardToGoogleAppsScript(res.headers.location, payloadString, redirectCount + 1));
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', reject);

    if (redirectCount === 0 && payloadString) {
      req.write(payloadString);
    }
    req.end();
  });
}

exports.handler = async (event) => {
  // Common CORS response headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Method Not Allowed',
        message: 'Only POST requests are supported.'
      })
    };
  }

  try {
    const rawBody = event.body || '{}';
    let parsedBody;
    try {
      parsedBody = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'Invalid JSON payload received.'
        })
      };
    }

    // Honeypot check
    if (parsedBody.website && String(parsedBody.website).trim() !== '') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          testMode: false,
          message: 'Submission rejected.'
        })
      };
    }

    // Forward to Google Apps Script
    const result = await forwardToGoogleAppsScript(APPS_SCRIPT_URL, JSON.stringify(parsedBody));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: result.data
    };
  } catch (err) {
    console.error('Error forwarding form submission:', err);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Bad Gateway',
        message: 'Failed to communicate with the Google Apps Script backend: ' + err.message
      })
    };
  }
};
