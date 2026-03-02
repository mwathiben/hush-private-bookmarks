import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Hush Private Bookmarks',
    description: 'Privacy-first hidden bookmarks for your browser',
    default_locale: 'en',
    permissions: ['storage', 'contextMenus', 'activeTab', 'bookmarks'],
    optional_permissions: ['history'],
  },
});
