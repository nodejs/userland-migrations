import('node:tls').then(function (tls) {
    const pair = tls.createSecurePair(credentials);
});
