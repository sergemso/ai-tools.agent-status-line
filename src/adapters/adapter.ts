// Adapter interface and registry for multi-agent support

import { UnifiedStatusInput, AgentType, UnifiedExtensions } from "shared/unified-model.js";

/**
 * Generic input type for each agent's raw JSON
 */
export type AgentInput = Record<string, unknown>;

/**
 * Adapter interface for converting agent-specific input to unified model
 */
export interface StatusLineAdapter {
  /** Unique agent type identifier */
  readonly agentType: AgentType;
  
  /** 
   * Convert agent-specific input to unified model
   * @throws Error if input cannot be parsed
   */
  parse(input: AgentInput): UnifiedStatusInput;
  
  /**
   * Check if this adapter can handle the given input
   * Used for auto-detection
   */
  canHandle(input: unknown): boolean;
  
  /**
   * Optional: transform formatted output for agent-specific rendering
   * e.g., Cursor provides render_width_chars, may need different ANSI handling
   */
  formatOutput?(line: string, extensions: UnifiedExtensions): string;

  /** Optional (setup wizard): a representative input of this agent, for previews */
  sampleInput?(): AgentInput;

  /**
   * Optional (setup wizard): measure the starting context size of a fresh session from this
   * agent's own history. Return null when it cannot be measured.
   */
  measureBaseline?(configDir: string): Promise<{ tokens: number; samples: number } | null>;

  /** Optional (setup wizard): whether this agent seems to be installed for the current user */
  isInstalled?(): boolean;
}

/**
 * Registry for managing and auto-detecting adapters
 */
export class AdapterRegistry {
  private adapters: StatusLineAdapter[] = [];
  private agentTypeMap: Map<AgentType, StatusLineAdapter> = new Map();
  
  /**
   * Register an adapter
   * Order matters for auto-detection - more specific adapters should be registered first
   */
  register(adapter: StatusLineAdapter): void {
    this.adapters.push(adapter);
    this.agentTypeMap.set(adapter.agentType, adapter);
  }
  
  /**
   * Auto-detect the correct adapter for the given input
   * Returns the first adapter whose canHandle() returns true
   */
  detect(input: unknown): StatusLineAdapter | undefined {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(input)) {
        return adapter;
      }
    }
    return undefined;
  }
  
  /**
   * Get adapter by agent type
   */
  get(agentType: AgentType): StatusLineAdapter | undefined {
    return this.agentTypeMap.get(agentType);
  }
  
  /**
   * Get all registered agent types
   */
  getAgentTypes(): AgentType[] {
    return Array.from(this.agentTypeMap.keys());
  }
  
  /**
   * Get all registered adapters
   */
  getAll(): StatusLineAdapter[] {
    return [...this.adapters];
  }
  
  /**
   * Parse input using the appropriate adapter (auto-detect if not specified)
   */
  parse(input: unknown, agentType?: AgentType): UnifiedStatusInput {
    let adapter: StatusLineAdapter | undefined;
    
    if (agentType) {
      adapter = this.get(agentType);
      if (!adapter) {
        throw new Error(`Unknown agent type: ${agentType}`);
      }
    } else {
      adapter = this.detect(input);
      if (!adapter) {
        // Default to Claude Code for backward compatibility
        adapter = this.get("claude-code");
        if (!adapter) {
          throw new Error("No adapter available and no default found");
        }
      }
    }
    
    return adapter.parse(input as AgentInput);
  }
}

/**
 * Global registry instance
 */
export const adapterRegistry = new AdapterRegistry();

/**
 * Helper to create a basic canHandle check for an agent
 */
export function createCanHandle(
  requiredFields: Record<string, (val: unknown) => boolean>
): (input: unknown) => boolean {
  return (input: unknown): boolean => {
    if (!input || typeof input !== "object") return false;
    const obj = input as Record<string, unknown>;
    
    for (const [field, check] of Object.entries(requiredFields)) {
      if (!(field in obj) || !check(obj[field])) {
        return false;
      }
    }
    return true;
  };
}