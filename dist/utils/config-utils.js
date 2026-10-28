// Config utilities shared between modules
import { join } from "path";
export function getClaudeConfigDir() {
    return process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "~", ".claude");
}
//# sourceMappingURL=config-utils.js.map