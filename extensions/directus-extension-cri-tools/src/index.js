export default {
  id: 'cri-tools',
  name: 'Outils CRI',
  icon: 'analytics',
  routes: [
    {
      path: '',
      component: {
        template: `
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #f5f7fa; z-index: 10;">
            <iframe src="/cri-admin/" style="width: 100%; height: 100%; border: none; display: block;" title="Outils CRI"></iframe>
          </div>
        `
      }
    }
  ]
};
