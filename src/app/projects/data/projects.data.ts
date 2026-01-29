import { Project } from '../models/project.model';

function svgPlaceholderDataUrl(label: string) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <rect x="60" y="60" width="1080" height="680" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>
  <text x="100" y="170" fill="rgba(255,255,255,0.92)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="56" font-weight="700">
    ${label}
  </text>
  <text x="100" y="235" fill="rgba(255,255,255,0.70)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="28">
    Placeholder image (swap with real cover later)
  </text>
  <path d="M110 620 L360 420 L530 560 L700 360 L1090 660" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="355" cy="420" r="16" fill="rgba(255,255,255,0.35)"/>
  <circle cx="700" cy="360" r="16" fill="rgba(255,255,255,0.35)"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const PROJECTS: Project[] = [
  {
    slug: 'example-project',
    title: 'Example Project',
    excerpt: 'Short teaser text for the tile (placeholder).',
    coverImage: svgPlaceholderDataUrl('Example Project'),
    hoverImage: svgPlaceholderDataUrl('Example Project (Hover)'),
    description:
      'This is placeholder copy for the project detail page. Replace it with a real description later (what it is, your role, stack, and outcomes).',
    links: [
      { label: 'Live', url: '#' },
      { label: 'Code', url: '#' }
    ],
    gallery: [
      svgPlaceholderDataUrl('Example Project — Image 1'),
      svgPlaceholderDataUrl('Example Project — Image 2'),
      svgPlaceholderDataUrl('Example Project — Image 3')
    ]
  },
  {
    slug: 'AI-Social-Media-Content-Engine',
    title: 'AI Social Media Content Engine',
    excerpt: 'Autonomous Content Engine',
    coverImage: 'assets/images/AI_Image_Generator_Base.png',
    hoverImage: 'assets/images/AI_Image_Generator_Hover.png',
    description:
      'Built a Python-based automation system to generate and publish large-scale AI visual content across social platforms while optimizing costs through browser-based automation.',
    gallery: [
      'assets/images/AI_Image_Generator_Base.png',
      'assets/images/AI_Image_Generator_Hover.png',
      'assets/images/AI_Image_Generator_Gallery2.png',
      'assets/images/AI_Image_Generator_Gallery.png',
    ]
  }
];

