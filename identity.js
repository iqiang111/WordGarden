const crypto = require('node:crypto');

function browserIdentity(secret) {
  const sign = value => crypto.createHmac('sha256', secret).update(value).digest('hex');
  return (req, res, next) => {
    const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('wg_browser='))?.slice(11);
    const match = /^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(cookie || '');
    let browser;
    if (match && crypto.timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(sign(match[1]), 'hex'))) browser = match[1];
    if (!browser) {
      browser = crypto.randomBytes(16).toString('hex');
      res.cookie('wg_browser', `${browser}.${sign(browser)}`, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 365 * 86400000, path: '/' });
    }
    req.participantHash = `browser:${sign(browser)}`;
    next();
  };
}
module.exports = { browserIdentity };
