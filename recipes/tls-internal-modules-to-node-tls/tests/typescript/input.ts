import type { SecureContext } from '_tls_common';
import type { TLSSocket } from 'node:_tls_wrap';

function check(ctx: SecureContext, socket: TLSSocket): void {}
