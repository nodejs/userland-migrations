const net = require('net')
const tls = require('tls')
const fs = require('fs')
const path = require('path')

const certDir = path.join(__dirname, '..')
const options = {
  key: fs.readFileSync(path.join(certDir, 'key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
  isServer: true
}

const server = net.createServer((socket) => {
  const tlsSocket = new tls.TLSSocket(socket, options)

  tlsSocket.on('secure', () => {
    tlsSocket.write('Hello from basic TLSSocket server!\n')
    tlsSocket.end()
  })
})

const PORT = process.env.PORT || 8444

server.listen(PORT, () => {
  console.log('[basic] Server listening on port', PORT)
})

module.exports = server
