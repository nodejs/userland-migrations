import { Duplex } from 'node:stream';

const both = Duplex.toWeb(stream, {
	type: legacyType,
	readableType: selectedType,
});
const spread = Duplex.toWeb(stream, { ...defaults, type: 'bytes' });
const computed = Duplex.toWeb(stream, { [key]: value, type: 'bytes' });
const getter = Duplex.toWeb(stream, { get type() { return 'bytes'; } });
const duplicate = Duplex.toWeb(stream, { type: 'a', type: 'bytes' });
const shared = Duplex.toWeb(stream, options);
