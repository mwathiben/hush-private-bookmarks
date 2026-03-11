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
    permissions: ['storage', 'contextMenus', 'activeTab', 'bookmarks', 'alarms'],
    optional_permissions: ['history'],
    incognito: 'spanning',
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+H' },
        description: 'Open Hush popup',
      },
    },
  },
});
