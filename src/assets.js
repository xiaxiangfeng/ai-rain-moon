// Vite uses / in development and ./ in the portable production build.
// Resolve public assets from the page's deployment directory, not site root.
export const assetUrl = path => `${import.meta.env.BASE_URL}assets/${path}`;
