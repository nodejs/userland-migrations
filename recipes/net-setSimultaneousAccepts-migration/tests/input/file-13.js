import net, { isIP, isIPv4, isIPv6 } from "node:net";

net._setSimultaneousAccepts(true);

const ipv4 = isIPv4('127.0.0.1');
const ipv6 = isIPv6('::1');
const ip = isIP('192.168.1.1');

console.log({ ipv4, ipv6, ip });
