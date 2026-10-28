import { ConfigSettings } from "./types.js";
export interface ConfigFile {
    path: string;
    data: ConfigSettings;
}
export declare function getConfigPath(claudeConfigDir: string): string;
export declare function loadConfig(claudeConfigDir: string): Promise<ConfigSettings>;
export declare function getCachedConfig(): ConfigSettings | null;
export declare function getSetting(data: ConfigSettings, key: keyof ConfigSettings): string | undefined;
export declare function hasSetting(data: ConfigSettings, key: keyof ConfigSettings): boolean;
export declare function putSetting(claudeConfigDir: string, key: keyof ConfigSettings, value: string): Promise<void>;
export declare function putSettings(claudeConfigDir: string, entries: Array<[keyof ConfigSettings, string]>): Promise<void>;
export declare function dropSettings(claudeConfigDir: string, keys: (keyof ConfigSettings)[]): Promise<void>;
export declare function resetAllSettings(claudeConfigDir: string): Promise<void>;
//# sourceMappingURL=config-file.d.ts.map