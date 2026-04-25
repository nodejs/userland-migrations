import crypto from "node:crypto";

const fipsStatus = crypto.getFips();
crypto.setFips(!fipsStatus);
