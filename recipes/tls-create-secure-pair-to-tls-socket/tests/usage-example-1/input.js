const net = require('net')
const tls = require('tls')
const fs = require('fs')
const path = require('path')

const certDir = path.join(__dirname, '..')
const options = {
  key: fs.readFileSync(path.join(certDir, 'key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'cert.pem'))
}

const server = net.createServer((socket) => {
  // Simplest SecurePair usage: create, pipe, use cleartext
  const pair = tls.createSecurePair(
    tls.createSecureContext(options),
    true,
    false,
    false
  )

  socket.pipe(pair.encrypted)
  pair.encrypted.pipe(socket)

  pair.on('secure', () => {
    pair.cleartext.write('Hello from basic SecurePair server!\n')
    pair.cleartext.end()
  })
})

const PORT = process.env.PORT || 8444

server.listen(PORT, () => {
  console.log('[basic] Server listening on port', PORT)
})

module.exports = server
