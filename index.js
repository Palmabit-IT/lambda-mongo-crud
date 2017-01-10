'use strict'

const success = (code, data, options) => {
  const opt = typeof options === 'object' ? options : {}

  const headers = {
    'Content-Type': 'application/json'
  }

  if (opt.cors !== false) {
    headers['Access-Control-Allow-Origin'] = '*'
  }

  data = data || {}

  return {
    statusCode: (code || 200).toString(),
    body: JSON.stringify(data),
    headers: headers
  }
}

module.exports = {
  success: success
}