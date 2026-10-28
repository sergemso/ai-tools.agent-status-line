import { PriceTable } from "./types.js";
export declare function getPricesPath(claudeConfigDir: string): string;
export declare function loadPrices(claudeConfigDir: string, ttl?: number): Promise<PriceTable>;
export declare function savePrices(claudeConfigDir: string, table: PriceTable): Promise<void>;
export declare function matchModelPrice(table: PriceTable, modelName: string, baseModel: string, fastMode: boolean): number | null;
//# sourceMappingURL=prices.d.ts.map