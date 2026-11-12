import stream from 'node:stream';

const pair = stream.Duplex.toWeb(source, {
	type: 'bytes',
});
