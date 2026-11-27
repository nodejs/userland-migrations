import { registerHooks as registerLoader } from "node:module";
import * as hooks from "./hooks.mjs";

registerLoader(hooks);
