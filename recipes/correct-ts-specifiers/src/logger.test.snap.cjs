exports[`logger > should emit error entries to standard error, collated by source module 1`] = `
" • sh*t happened\\n • maybe bad\\n • sh*t happened\\n • maybe other bad\\n[Codemod: correct-ts-specifiers]: migration incomplete!\\n"
`;

exports[`logger > should emit non-error entries to standard out, collated by source module 1`] = `
"[Codemod: correct-ts-specifiers]: /tmp/foo.js\\n • maybe don’t\\n • maybe not that either\\n • still maybe don’t\\n • more maybe not\\n[Codemod: correct-ts-specifiers]: migration complete!\\n"
`;
