# packages/ui Dependencies

All dependencies for the Lectern UI package are fully local, self-contained, and contain no CDN links, external Google Fonts, analytics, or telemetry.

## Runtime Dependencies

| Package | Version | Purpose & Rationale |
|---------|---------|---------------------|
| `react` | `^19.0.0` | Core UI library for declarative, reactive component hierarchy. |
| `react-dom` | `^19.0.0` | DOM renderer for React components. |
| `lucide-react` | `^1.16.0` | Tree-shakeable SVG icons bundled locally. Zero external network requests, zero telemetry, clean UI styling. |

## Development Dependencies

| Package | Version | Purpose & Rationale |
|---------|---------|---------------------|
| `vite` | `^6.0.7` | Fast ES module bundler and local dev server for running the dev showcase. |
| `@vitejs/plugin-react` | `^4.3.4` | Vite plugin providing React Fast Refresh and JSX transformation. |
| `typescript` | `^5.7.2` | Static typing ensuring compliance with the Lectern API contract and robust interfaces. |
| `@types/react` | `^19.0.0` | TypeScript definitions for React. |
| `@types/react-dom` | `^19.0.0` | TypeScript definitions for React DOM. |
| `tailwindcss` | `^3.4.17` | Utility-first CSS framework for clean, high-contrast, modern responsive styling (processed locally at build time). |
| `postcss` | `^8.4.49` | PostCSS processor for Tailwind CSS. |
| `autoprefixer` | `^10.4.20` | PostCSS plugin for vendor prefixes. |

## External Assets & Privacy Guarantees
- **Fonts**: Strictly uses a system font stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). No Google Fonts or remote font downloads.
- **CDNs**: Zero CDN scripts, styles, or media links. All assets are self-hosted or generated locally.
- **Telemetry / Analytics**: Completely disabled / absent. No trackers, beacons, or third-party pings. Fully offline compatible.
