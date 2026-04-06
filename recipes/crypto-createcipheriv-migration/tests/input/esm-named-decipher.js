import { createDecipher } from "node:crypto";

const decrypted = createDecipher("aes-192-cbc", "secret");
