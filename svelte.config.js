// workerd (pulled in by adapter-cloudflare via wrangler) has no win32-arm64 build and
// throws on import, so skip the adapter there. Dev, check and tests don't need it;
// production builds run on Cloudflare's Linux builders.
const noWorkerd = process.platform === 'win32' && process.arch === 'arm64';
const adapter = noWorkerd ? undefined : (await import('@sveltejs/adapter-cloudflare')).default();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter
	}
};

export default config;
