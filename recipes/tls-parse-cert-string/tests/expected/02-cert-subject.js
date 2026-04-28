const tls = require('node:tls');

const socket = tls.connect(443, 'example.com', () => {
	const cert = socket.getPeerCertificate();
	const subject = /* DEP0076: cert.subject/cert.issuer are already parsed */ cert.subject;
	console.log(subject);
});
