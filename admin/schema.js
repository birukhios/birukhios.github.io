/* Content schema.
 *
 * Drives both the collection list and the recursive form renderer. Field types:
 *   text     single-line
 *   area     multi-line
 *   image    path to a file in the repo, with upload + picker
 *   select   fixed options
 *   strings  list of plain strings
 *   list     list of objects, described by `fields`
 *
 * `summary` picks the label shown for a collapsed list item.
 */
window.SCHEMA = [
  {
    name: 'projects',
    label: 'Case Studies',
    file: 'content/projects.json',
    hint: 'The Selected Work cards and their full case-study pages.',
    summary: (v) => v.name,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'id', label: 'ID (url slug)', type: 'text', hint: 'Lowercase, no spaces. Changing this breaks existing links.' },
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'text', hint: 'e.g. “Design system · 1,394 components · Remote”' },
      { key: 'group', label: 'Group', type: 'select', options: ['work', 'play'] },
      { key: 'status', label: 'Status', type: 'text', hint: 'Badge on the card — Delivered, Shipped, Case study…' },
      { key: 'blurb', label: 'Card blurb', type: 'area' },
      { key: 'summary', label: 'Summary', type: 'area', hint: 'The lede at the top of the case study.' },
      { key: 'problem', label: 'The problem I set out to solve', type: 'area' },
      { key: 'solve', label: 'How I solved it', type: 'area' },
      { key: 'projectType', label: 'Project type', type: 'text' },
      { key: 'role', label: 'My role', type: 'text' },
      { key: 'platform', label: 'Platform', type: 'text' },
      { key: 'figma', label: 'Figma URL', type: 'text' },
      { key: 'swatch', label: 'Accent swatch', type: 'text', hint: 'Hex, e.g. #15C5CE' },
      { key: 'cover', label: 'Cover image', type: 'image' },
      { key: 'coverTitle', label: 'Cover title', type: 'text' },
      { key: 'coverLine', label: 'Cover line', type: 'text' },
      { key: 'shots', label: 'Card thumbnails', type: 'strings', of: 'image', hint: 'Three images shown on the Selected Work card.' },
      { key: 'meta', label: 'Tags', type: 'strings' },
      { key: 'did', label: 'What I did', type: 'strings', of: 'area' },
      {
        key: 'sections', label: 'Case-study sections', type: 'list',
        summary: (v) => (v.label ? v.label + ' — ' : '') + (v.title || ''),
        fields: [
          { key: 'label', label: 'Kicker', type: 'text' },
          { key: 'title', label: 'Heading', type: 'text' },
          { key: 'paras', label: 'Paragraphs', type: 'strings', of: 'area' },
          {
            key: 'points', label: 'Side points', type: 'list',
            summary: (v) => v.head,
            fields: [
              { key: 'head', label: 'Heading', type: 'text' },
              { key: 'body', label: 'Body', type: 'area' },
            ],
          },
          {
            key: 'images', label: 'Images', type: 'list',
            summary: (v) => v.cap || v.src,
            fields: [
              { key: 'src', label: 'Image', type: 'image' },
              { key: 'cap', label: 'Caption', type: 'text' },
              { key: 'wide', label: 'Full width', type: 'bool' },
            ],
          },
          {
            key: 'tradeoffs', label: 'Tradeoffs', type: 'list',
            summary: () => 'Tradeoff',
            fields: [
              { key: 'old', label: "The version I didn't ship", type: 'area' },
              { key: 'now', label: 'Why it shipped this way', type: 'area' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'mood', label: 'Moodboard', file: 'content/mood.json',
    hint: 'The Play grid.',
    summary: (v) => v.title,
    fields: [
      { key: 'src', label: 'Image', type: 'image' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'note', label: 'Note', type: 'area' },
      { key: 'ar', label: 'Aspect ratio', type: 'text', hint: 'e.g. 16 / 10' },
    ],
  },
  {
    name: 'branding', label: 'Branding', file: 'content/branding.json',
    hint: 'The Sorenie identity strip on Play.',
    summary: (v) => v.title,
    fields: [
      { key: 'src', label: 'Image', type: 'image' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'note', label: 'Note', type: 'area' },
    ],
  },
  {
    name: 'posters', label: 'Posters', file: 'content/posters.json',
    summary: (v) => v.title,
    fields: [
      { key: 'src', label: 'Image', type: 'image' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'note', label: 'Note', type: 'area' },
    ],
  },
  {
    name: 'sites', label: 'Client sites', file: 'content/sites.json',
    summary: (v) => v.name,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'text' },
      { key: 'cover', label: 'Cover image', type: 'image' },
      { key: 'note', label: 'Note', type: 'area' },
      { key: 'live', label: 'Live URL', type: 'text' },
    ],
  },
  {
    name: 'experience', label: 'Experience', file: 'content/experience.json',
    hint: 'Shown on About and Resume.',
    summary: (v) => v.org + ' — ' + v.title,
    fields: [
      { key: 'org', label: 'Organisation', type: 'text' },
      { key: 'title', label: 'Job title', type: 'text' },
      { key: 'when', label: 'Dates', type: 'text', hint: 'e.g. “Jul 2024 — Dec 2025”' },
      { key: 'place', label: 'Location', type: 'text' },
      { key: 'note', label: 'Short note', type: 'area' },
      { key: 'points', label: 'Bullets', type: 'strings', of: 'area' },
    ],
  },
  {
    name: 'education', label: 'Education', file: 'content/education.json',
    summary: (v) => v.title,
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'institution', label: 'Institution', type: 'text' },
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'note', label: 'Note', type: 'area' },
    ],
  },
  {
    name: 'services', label: 'How I can help', file: 'content/services.json',
    summary: (v) => v.title,
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Body', type: 'area' },
    ],
  },
  {
    name: 'process', label: 'How I work', file: 'content/process.json',
    hint: 'The six numbered steps on the Work page.',
    summary: (v) => v.n + ' — ' + v.title,
    fields: [
      { key: 'n', label: 'Number', type: 'text', hint: 'e.g. 01' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Body', type: 'area' },
    ],
  },
];
