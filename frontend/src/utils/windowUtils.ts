export const openInternalWindow = (route: string, features: string = 'width=1000,height=800') => {
    // In Electron with file:// protocol, path-only URLs starting with / resolve to filesystem root (C:/).
    // To fix "Not allowed to load local resource", we must construct an absolute URL relative to the current index.html.

    // 1. Get current base (protocol + path to index.html, stripping hashes and queries)
    const baseUrl = window.location.href.split('#')[0].split('?')[0];

    // 2. Clean the route (ensure it's just the hash part, e.g. "debug-logs")
    const hashRoute = route.startsWith('/#') ? route.substring(2) : (route.startsWith('#') ? route.substring(1) : (route.startsWith('/') ? route.substring(1) : route));

    // 3. Combine
    const finalUrl = `${baseUrl}#/${hashRoute}`;

    console.log('[WINDOW] Opening internal route:', { route, finalUrl });
    window.open(finalUrl, '_blank', features);
};
