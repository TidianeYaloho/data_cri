function installCriTitleCleaner() {
  if (
    typeof window === 'undefined' ||
    window.__criTitleCleanerInstalled
  ) return;

  window.__criTitleCleanerInstalled = true;

  const expectedTitle = 'BANQUE DE PROJETS';

  function enforceTitle() {
    if (document.title !== expectedTitle) {
      document.title = expectedTitle;
    }
  }

  function startObserver() {
    if (!document.head) {
      setTimeout(startObserver, 100);
      return;
    }

    enforceTitle();

    const observer = new MutationObserver(enforceTitle);

    observer.observe(document.head, {
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
