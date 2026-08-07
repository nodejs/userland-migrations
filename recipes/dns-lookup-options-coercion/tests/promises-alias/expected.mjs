import { promises as dnsPromises } from "node:dns";

await dnsPromises.lookup("example.com", { family: 4, verbatim: false });
