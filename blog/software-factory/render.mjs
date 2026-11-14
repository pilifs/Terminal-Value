// The Software Factory pages. Owned by stream B (dashboard):
// llm-dlc/loops/software-factory-dashboard.md. The browser side is
// blog/assets/software-factory/ (app.js, style.css), also stream B's.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   renderPages({ snapshot, unavailable, fixture, posts, site, helpers, paths })
//     -> [{ path, title, description, body }]
//     snapshot is { pointer, manifest, overview } or null, with unavailable
//     saying why; fixture is true when the data is a test fixture, which the
//     pages must say plainly. posts is editorial.selectPosts() output. helpers
//     has escapeHtml, formatDate and postImage. paths has route, staticData and
//     remoteData. path is relative to /software-factory/: 'index.html',
//     'analysis/index.html', 'methodology/index.html'. body is the HTML inside
//     <main>; index.mjs wraps it in the site layout with the section's class,
//     styles and scripts. The static HTML carries meaningful numbers and the
//     post links without any script.

export function renderPages({ unavailable, helpers }) {
  // Phase 0 placeholder, seen only in drafts builds until stream B replaces it.
  const note = unavailable ? `<p>${helpers.escapeHtml(unavailable)}</p>` : '';
  return [
    {
      path: 'index.html',
      title: 'Software Factory',
      description: 'What the software factory produces, how its activity and efficiency change, and what running it teaches.',
      body: `      <h1>Software Factory</h1>\n      <p>Not built yet.</p>\n      ${note}`,
    },
  ];
}
