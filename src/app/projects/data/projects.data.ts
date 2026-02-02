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
    excerpt: 'Autonomous Growth',
    coverImage: 'assets/images/AI_Image_Generator_Base.png',
    hoverImage: 'assets/images/AI_Image_Generator_Hover.png',
    description: `This Python-based automation system generates and publishes AI visual content across social platforms, while optimizing costs through browser-based automation with Selelium.

      Given a list of keywords to define a content page, the system will generate image prompts, generate videos or images, and automatically publish them to all social platforms.
    `,
    techStack: [
      'Python',
      'OpenAI API',
      'Google Drive API',
      'Selenium',
      'ChromeDriver',
      'Chrome DevTools',
    ],
    gallery: [
      'assets/images/AI_Image_Generator_Base.png',
      'assets/images/AI_Image_Generator_Hover.png',
      'assets/images/AI_Image_Generator_Gallery2.png',
      'assets/images/AI_Image_Generator_Gallery.png',
    ]
  },
  {
    slug: 'AI-Knowledge-Base-Query-Tool',
    title: 'AI Knowledge Base Query Tool',
    excerpt: 'Search & Retrieve',
    coverImage: 'assets/images/Knowledgebase_Base.png',
    hoverImage: 'assets/images/Knowledgebase_Hover.png',
    description: `This retrieval-augmented intelligence system transforms enterprise documents into queryable knowledge. Users can upload PDFs and receive context-aware answers grounded directly in the source material.

  To work, I custom built a vector-based embedding pipeline to semantically index documents, paired with automatically generating relevant meta data and questions to quicken search and retrieval.
    `,
    techStack: [
      'TypeScript',
      'Angular',
      'Node.js',
      'OpenAI / Embeddings',
      'Vector Databases',
    ],
    gallery: [
      'assets/images/Knowledgebase_Base.png',
      'assets/images/Knowledgebase_Hover.png',
    ]
  },
  {
    slug: 'AWS-Hosted-AI-App-Store-Review-Platform',
    title: 'App Store Review Platform',
    excerpt: 'AI Augmentation',
    coverImage: 'assets/images/Review_Platform_Base.png',
    hoverImage: 'assets/images/Review_Platform_Hover.png',
    description: `Designed and deployed an AWS hosted, AI platform to ingest, analyze, and respond to customer reviews across both the Apple App Store and Google Play Store for a Tier-1 banking client.

  The system continuously retrieves user reviews, categorizes feedback, and performs sentiment analysis to surface trends and insights for internal stakeholders. Leveraging AWS Bedrock, the platform generates context-aware, brand-aligned response drafts that can be reviewed and published directly to app store listings, significantly reducing manual effort.

  Includes an internal dashboard for employees to review individual feedback, monitor sentiment distribution, and analyze review volume and themes at scale.
    `,
    techStack: [
      'Angular',
      'TypeScript',
      'Node.js',
      'AWS Fargate',
      'AWS Lambda',
      'AWS Bedrock',
      'Application Load Balancers',
      'Virtual Private Cloud (VPC)',
      'Azure Active Directory Authentication',
      'Apple App Store & Google Play APIs',
    ],
    gallery: [
      'assets/images/Review_Platform_Base.png',
      'assets/images/Review_Platform_Hover.png',
    ]
  },
];

