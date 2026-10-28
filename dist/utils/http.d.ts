export interface FetchOptions {
    timeout?: number;
    headers?: Record<string, string>;
}
export declare function fetchWithTimeout(url: string, options?: FetchOptions): Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<any>;
}>;
//# sourceMappingURL=http.d.ts.map