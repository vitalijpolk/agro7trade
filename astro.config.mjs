import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://agro7trade.com.ua',
  integrations: [sitemap()],
});
