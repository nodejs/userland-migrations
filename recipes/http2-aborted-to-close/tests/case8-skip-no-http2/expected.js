const { EventEmitter } = require('node:events');

const stream = new EventEmitter();
stream.on('aborted', () => {
	recordIncompleteResponse();
});
