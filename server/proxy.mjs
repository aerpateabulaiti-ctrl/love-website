const UPSTREAM = 'https://okpcwsianqkouitdwhvx.supabase.co';
const TABLES = new Set(['photos', 'bucket_list', 'timeline', 'visited_provinces']);
function failure(message, status) {
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function forward(context, kind) {
    const { request, params } = context;
    const source = new URL(request.url);
    const publicImage = kind === 'image';
    const methods = publicImage ? ['GET', 'HEAD'] : kind === 'db' ? ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'] : ['POST', 'DELETE'];
    if (!methods.includes(request.method)) return failure('Method not allowed', 405);
    let upstream;
    if (kind === 'db') {
        const table = params.table;
        if (!TABLES.has(table)) return failure('Unknown table', 404);
        upstream = new URL('/rest/v1/' + table, UPSTREAM);
        upstream.search = source.search;
        if (['PATCH', 'DELETE'].includes(request.method) && !source.searchParams.has('id') && !source.searchParams.has('name')) {
            return failure('A record filter is required', 400);
        }
    } else {
        const segments = Array.isArray(params.path) ? params.path : [params.path];
        if (!segments.length || segments.some(part => !part || !/^[a-zA-Z0-9_.-]+$/.test(part) || part === '.' || part === '..')) return failure('Invalid photo path', 400);
        if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(segments[segments.length - 1])) return failure('Unsupported photo format', 400);
        upstream = new URL('/storage/v1/object/' + (publicImage ? 'public/' : '') + 'photos/' + segments.join('/'), UPSTREAM);
    }
    const headers = new Headers();
    if (!publicImage) {
        const key = request.headers.get('apikey');
        if (!key) return failure('API key required', 401);
        // Forward the visitor's existing public credentials; never introduce a service-role key.
        for (const name of ['apikey', 'authorization', 'content-type', 'prefer', 'cache-control', 'x-upsert']) {
            const value = request.headers.get(name);
            if (value) headers.set(name, value);
        }
    } else {
        for (const name of ['if-none-match', 'if-modified-since', 'range']) {
            const value = request.headers.get(name);
            if (value) headers.set(name, value);
        }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), publicImage ? 25000 : 20000);
    try {
        const options = { method: request.method, headers, signal: controller.signal, redirect: 'manual' };
        if (!['GET', 'HEAD'].includes(request.method)) options.body = request.body;
        const response = await fetch(upstream.toString(), options);
        // Do not redirect mobile clients back to the origin they cannot reach.
        if (response.status >= 300 && response.status < 400 && response.status !== 304) return failure('Unexpected upstream redirect', 502);
        const output = new Headers();
        for (const name of ['content-type', 'content-length', 'content-range', 'etag', 'last-modified', 'accept-ranges']) {
            const value = response.headers.get(name);
            if (value) output.set(name, value);
        }
        output.set('Cache-Control', publicImage && (response.ok || response.status === 304) ? 'public, max-age=31536000, immutable' : 'no-store');
        output.set('X-Content-Type-Options', 'nosniff');
        return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers: output });
    } catch (error) {
        return failure(error.name === 'AbortError' ? 'Upstream timed out' : 'Upstream is temporarily unavailable', 502);
    } finally { clearTimeout(timeout); }
}
