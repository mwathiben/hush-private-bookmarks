import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Hush Private Bookmarks',
    description: 'Privacy-first hidden bookmarks for your browser',
    permissions: ['storage', 'contextMenus', 'activeTab', 'bookmarks'],
    optional_permissions: ['history'],
  },
});
