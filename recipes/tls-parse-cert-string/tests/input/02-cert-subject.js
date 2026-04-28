const tls = require('node:tls');

const socket = tls.connect(443, 'example.com', () => {
	const cert = socket.getPeerCertificate();
	const subject = tls.parseCertString(cert.subject);
	console.log(subject);
});
