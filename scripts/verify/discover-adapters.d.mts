export interface DiscoveredAdapter {
	name: string;
	server: string | null;
	client: string;
	module: string;
}
export declare function parseAdapterExports(
	indexSource: string
): { name: string; module: string }[];
export declare function discoverAdapters(root?: string): DiscoveredAdapter[];
export declare function adapterSourceModules(root?: string): string[];
export declare function selfCheckDiscovery(root?: string): string[];
