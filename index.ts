console.log({
	has: {
		field: 'function',
		kind: 'member_expression',
		has: {
			field: 'object',
			regex: `^foo$`,
		},
		has: {
			field: 'property',
			regex: '^(onFinish|onFailure)$',
		},
	},
});
