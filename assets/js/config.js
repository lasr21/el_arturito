// Everything Luis may want to edit lives here.

export const SITE = {
  title: '¿Dónde comió el Arturito?',
  author: 'lasr21',
  // Where people can reach you (corrections, takedown requests): shown as "mándame un DM en X o Instagram".
  social: [
    { label: 'X', url: 'https://x.com/lasr21' },
    { label: 'Instagram', url: 'https://www.instagram.com/lasr21/' },
  ],
  repoUrl: 'https://github.com/lasr21/el_arturito',
};

export const CREATOR = {
  name: 'El Arturito',
  handle: '@soyelarturito',
  links: [
    { label: 'TikTok', url: 'https://www.tiktok.com/@soyelarturito' },
    { label: 'YouTube', url: 'https://www.youtube.com/@soyelarturito' },
    // TODO(Luis): add Instagram once the handle is verified.
  ],
};

export const DATA_URL = 'data/lugares.json'; // relative to index.html
export const SUMMARIES_URL = 'data/resumenes.json'; // optional; the page works without it
export const SHOW_NEEDS_REVIEW = true;       // false hides entries flagged by the pipeline
export const LIST_PREVIEW = 5;               // items shown before "Ver N más"
