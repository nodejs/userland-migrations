const { format } = require('node:url')

const a = new URL('https://example.com:8080/p?page=1&format=json#frag').toString()
