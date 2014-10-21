var oboe = require('oboe');

module.exports = function(url, method, headers, body) {
  return oboe({
    url: url,
    method: method || 'GET',
    headers: headers,
    body: body
  });
}