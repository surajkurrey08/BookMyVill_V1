const SMS_TIMEOUT_MS = 12_000;

const getSmsConfig = () => {
  const apiUrl = process.env.SMS_API_URL;
  const username = process.env.SMS_USERNAME;
  const password = process.env.SMS_PASSWORD || process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID || 'BKMYVA';
  const templateId = process.env.SMS_TEMPLATE_ID || '1777179206833227479';

  if (!apiUrl || !username || !password || !senderId || !templateId) {
    throw new Error('SMS gateway is not configured.');
  }

  let endpoint;
  try {
    endpoint = new URL(apiUrl);
  } catch {
    throw new Error('SMS gateway URL is invalid.');
  }
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('SMS gateway URL must use HTTP or HTTPS.');
  }

  return { endpoint, username, password, senderId, templateId };
};

const providerAccepted = (body) => {
  const trimmed = body.trim();
  if (!trimmed) return false;

  try {
    const parsed = JSON.parse(trimmed);
    const status = String(parsed.status ?? parsed.statusCode ?? parsed.code ?? '').toLowerCase();
    return ['000', '0', '1', 'success', 'accepted'].includes(status);
  } catch {
    // Some gateway accounts return the documented plain-text response instead
    // of JSON; do not log that body because provider responses may contain PII.
    return /^\s*(?:000\s*:?|success\b|accepted\b)/i.test(trimmed);
  }
};

const sendPhoneOtp = async ({ phone, otp }) => {
  const { endpoint, username, password, senderId, templateId } = getSmsConfig();
  const message = `Welcome to BookMyVilla! Your login OTP is ${otp}. It is valid for 5 minutes. Please do not share this OTP with anyone. - BookMyVilla`;
  const form = new URLSearchParams({
    mobile: username,
    pass: password,
    senderid: senderId,
    to: `91${phone}`,
    msg: message,
    templateid: templateId,
    restype: 'json'
  });
  if (process.env.SMS_PE_ID) form.set('peid', process.env.SMS_PE_ID);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: controller.signal
    });
    const responseBody = await response.text();
    if (!response.ok || !providerAccepted(responseBody)) {
      throw new Error('SMS gateway did not accept the OTP message.');
    }
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('SMS gateway request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { sendPhoneOtp };
