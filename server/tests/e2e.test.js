import test from 'node:test';
import assert from 'node:assert/strict';

const SERVER_URL = 'http://127.0.0.1:5002';
const CLIENT_URL = 'http://127.0.0.1:5174';

test('E2E: Vite Client is serving frontend application', async () => {
  const res = await fetch(CLIENT_URL);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('CovrIQ'), 'HTML must contain CovrIQ title');
});

test('E2E: Backend Health Check is operational', async () => {
  const res = await fetch(`${SERVER_URL}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'healthy');
  assert.equal(data.app, 'CovrIQ Backend API');
});

test('E2E: User Registration and Authentication Flow', async () => {
  const testEmail = `sharp_${Date.now()}@covriq.ai`;
  const registerRes = await fetch(`${SERVER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'password123',
      name: 'Sharp Bettor'
    })
  });

  assert.equal(registerRes.status, 201);
  const regData = await registerRes.json();
  assert.ok(regData.token, 'Token should be returned on registration');
  assert.equal(regData.user.email, testEmail);

  // Test /api/auth/me
  const meRes = await fetch(`${SERVER_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${regData.token}` }
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.user.email, testEmail);
});

test('E2E: Forgot Password Brevo OTP Flow', async () => {
  const testEmail = `sharp_${Date.now()}@covriq.ai`;
  await fetch(`${SERVER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'password123', name: 'OTP Tester' })
  });

  // Request OTP
  const forgotRes = await fetch(`${SERVER_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });
  assert.equal(forgotRes.status, 200);
  const forgotData = await forgotRes.json();
  assert.ok(forgotData.devOtp, 'Dev OTP should be returned for test verification');

  // Reset Password using OTP
  const resetRes = await fetch(`${SERVER_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      otp: forgotData.devOtp,
      newPassword: 'newpassword456'
    })
  });
  assert.equal(resetRes.status, 200);
});

test('E2E: Streaming AI Sports Handicapping (/api/chat)', async () => {
  const chatRes = await fetch(`${SERVER_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Analyze Gerrit Cole tonight in MLB against Boston Red Sox at Fenway. Give moneyline odds value.',
      mode: 'value_finder'
    })
  });

  assert.equal(chatRes.status, 200);
  assert.equal(chatRes.headers.get('content-type'), 'text/event-stream');

  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let fullBody = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    fullBody += decoder.decode(value, { stream: true });
  }

  assert.ok(fullBody.includes('event: init'), 'SSE stream must include init event');
  assert.ok(fullBody.includes('event: status'), 'SSE stream must include status events');
  assert.ok(fullBody.includes('event: done'), 'SSE stream must include done event');
  assert.ok(fullBody.includes('MARKET_CARD') || fullBody.includes('marketCard'), 'Response must include market card data');
});
