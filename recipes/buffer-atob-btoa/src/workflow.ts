import type { Edit, Range, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';

export default function transform(root: SgRoot<Js>): string | null {
  const rootNode = root.root()
  const edits: Edit[] = [];
  const linesToRemove: Range[] = [];

  // @ts-expect-error - ast-grep types are not fully compatible with JSSG types
  const requireStatements = getNodeRequireCalls(root, 'buffer');
  const atobFunctionCalls = rootNode.findAll({
    rule: {
      pattern: `buffer.atob($ARG)`
    }
  });

  // Remove all buffer require statements
  for (const statement of requireStatements) {
    linesToRemove.push(statement.range());
  }

  // Rewrite atob function calls
  for (const call of atobFunctionCalls) {
    const argMatch = call.getMatch("ARG");
    if (argMatch) {
      const arg = argMatch.text();
      const replacement = `Buffer.from(${arg}, 'base64').toString('binary')`;
      edits.push(call.replace(replacement));
    }
  }

  const btoaFunctionCalls = rootNode.findAll({
    rule: {
      pattern: `buffer.btoa($ARG)`
    }
  });

  // Rewrite btoa function calls
  for (const call of btoaFunctionCalls) {
    const argMatch = call.getMatch("ARG");
    if (argMatch) {
      const arg = argMatch.text();
      const replacement = `Buffer.from(${arg}, 'binary').toString('base64')`;
      edits.push(call.replace(replacement));
    }
  }

  return removeLines(rootNode.commitEdits(edits), linesToRemove);
}