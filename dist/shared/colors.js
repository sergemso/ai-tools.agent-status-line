// ANSI color codes
export const RESET = "\x1b[0m";
export const DIM = "\x1b[2m";
export const CYAN = "\x1b[36m";
export const GREEN = "\x1b[32m";
export const YELLOW = "\x1b[33m";
export const RED = "\x1b[31m";
export function colorize(text, color) {
    return `${color}${text}${RESET}`;
}
export function dim(text) {
    return `${DIM}${text}${RESET}`;
}
export function cyan(text) {
    return `${CYAN}${text}${RESET}`;
}
export function green(text) {
    return `${GREEN}${text}${RESET}`;
}
export function yellow(text) {
    return `${YELLOW}${text}${RESET}`;
}
export function red(text) {
    return `${RED}${text}${RESET}`;
}
//# sourceMappingURL=colors.js.map