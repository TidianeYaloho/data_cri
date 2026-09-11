function installCriTitleCleaner() {
  if (
    typeof window === 'undefined' ||
    window.__criTitleCleanerInstalled
  ) return;

  window.__criTitleCleanerInstalled = true;

  function cleanTitle() {
    const prefix = 'Directus · ';

    if (document.title.startsWith(prefix)) {
      document.title = document.title.slice(prefix.length);
    }
  }

  function startObserver() {
    const titleElement = document.querySelector('title');

    if (!titleElement) {
      setTimeout(startObserver, 100);
      return;
    }

    cleanTitle();

    const observer = new MutationObserver(cleanTitle);

    observer.observe(titleElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  startObserver();
}

installCriTitleCleaner();
export default {
  id: 'cri-tools',
  name: 'Outils CRI',
  icon: 'analytics',
  routes: [
    {
      path: '',
      component: {
        template: `
          <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:#f5f7fa;z-index:10;">
            <iframe
              src="/cri-admin/"
              style="width:100%;height:100%;border:none;display:block;"
              title="Outils CRI"
            ></iframe>
          </div>
        `
      }
    }
  ]
};
