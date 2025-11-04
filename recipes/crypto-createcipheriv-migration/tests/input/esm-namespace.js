import crypto from "node:crypto";

const encrypted = crypto.createCipher("aes-256-cbc", "pw");
