export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    // Future: context menu creation, storage initialization
  });
});
