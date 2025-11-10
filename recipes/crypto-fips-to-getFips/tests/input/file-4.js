import crypto from "node:crypto";

const fipsStatus = crypto.fips;
crypto.fips = !fipsStatus;
