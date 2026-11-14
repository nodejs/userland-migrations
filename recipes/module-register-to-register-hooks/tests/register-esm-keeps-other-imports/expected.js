import { createRequire, registerHooks } from "node:module";
import * as hooks from "./hooks.mjs";

registerHooks(hooks);
