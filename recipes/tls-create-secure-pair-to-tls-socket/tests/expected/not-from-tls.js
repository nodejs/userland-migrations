// Without tls module - should not transform
const createSecurePair = someOtherModule.createSecurePair;
const pair = createSecurePair(credentials);
