/**
 * Renderers index - exports all renderer implementations and factory.
 */

export * from "./cli.js";
export * from "./vscode.js";
export * from "./neovim.js";
export * from "./opencode.js";

import type { Renderer } from "../renderer.js";
import type { RenderTarget } from "../model.js";
import { CliRenderer, cliRenderer } from "./cli.js";
import { VSCodeRenderer, vscodeRenderer } from "./vscode.js";
import { NeovimRenderer, neovimRenderer } from "./neovim.js";
import { OpenCodeRenderer, opencodeRenderer } from "./opencode.js";

/** Map of target to default renderer instance */
const DEFAULT_RENDERERS: Record<RenderTarget, Renderer<any, any>> = {
  cli: cliRenderer,
  vscode: vscodeRenderer,
  neovim: neovimRenderer,
  opencode: opencodeRenderer,
};

/** Map of target to renderer class (for customization) */
const RENDERER_CLASSES: Record<RenderTarget, new () => Renderer<any, any>> = {
  cli: CliRenderer,
  vscode: VSCodeRenderer,
  neovim: NeovimRenderer,
  opencode: OpenCodeRenderer,
};

/**
 * Get renderer instance for target.
 * Returns singleton default renderer.
 */
export function getRenderer<TOutput = any, TItemOutput = TOutput>(target: RenderTarget): Renderer<TOutput, TItemOutput> {
  const renderer = DEFAULT_RENDERERS[target];
  if (!renderer) {
    throw new Error(`Unknown render target: ${target}`);
  }
  return renderer as Renderer<TOutput, TItemOutput>;
}

/**
 * Create a new renderer instance for target.
 * Use this when you need to customize the renderer.
 */
export function createRenderer<TOutput = any, TItemOutput = TOutput>(target: RenderTarget): Renderer<TOutput, TItemOutput> {
  const RendererClass = RENDERER_CLASSES[target];
  if (!RendererClass) {
    throw new Error(`Unknown render target: ${target}`);
  }
  return new RendererClass() as Renderer<TOutput, TItemOutput>;
}

/** List of supported render targets */
export const SUPPORTED_TARGETS: RenderTarget[] = ["cli", "vscode", "neovim", "opencode"];