import { lookup } from "./lookup.mjs";

export async function resolve(specifier, context, nextResolve) {
	return nextResolve(lookup(specifier), context);
}
