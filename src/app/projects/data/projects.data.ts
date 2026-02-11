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

      It was a ton of fun to wake up every morning to see what the AI had generated and published overnight with some posts garnering thousands of views and likes such as the feautured video.

      With this proof of concept a success, it is no longer in use as I work on developing this project into a commercial product.
    `,
    techStack: [
      'Python',
      'OpenAI API',
      'Google Drive API',
      'Selenium',
      'ChromeDriver',
      'Chrome DevTools',
    ],
    links: [
      { label: 'Code', url: 'https://github.com/PatrickMihalcea/SocialMediaAutomation' },
    ],
    gallery: [
      'assets/images/AI House.mp4',
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
    description: `This retrieval-augmented intelligence system transforms enterprise documents into queryable knowledge. The client, a Tier-1 banking institution, loads PDFs and receive context-aware answers grounded directly in the source material.

  To work, our team custom built a vector-based embedding pipeline to semantically index documents, paired with automatically generating relevant meta data and questions to quicken search and retrieval.
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
    description: `In collaboration with client cloud architects, we designed and deployed an AWS hosted, AI platform to ingest, analyze, and respond to customer reviews across the Apple App Store and Google Play Store for a Tier-1 banking client.

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
      'EventBridge',
      'S3',
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
  {
    slug: 'Machine-Learning-Traffic-System',
    title: 'Machine Learning Traffic System',
    excerpt: 'Thesis Project',
    coverImage: 'assets/images/Intersection.png',
    hoverImage: 'assets/images/IntersectionSensors.png',
    description: `The idea was simple: in the far future, can self-driving cars be unified into a single fleet? And if so, can traffic lights become obsolete?

    For my undergraduate thesis, I designed a Unity simulation and used TensorFlow to convert car proximity and sensor inputs into steering and speed outputs using Post Proximal Optimization (PPO).

    Layered on top of the simulation, I implemented a "Master AI" that could control the entire fleet of cars, making decisions based on the current traffic situation.

    I then compared the performance of the cars alone vs. with the Master AI vs. with a traffic light system vs. combining Master AI with traffic lights.

    The results? The Master AI was able to achieve 3.6x throughput and 90% less stop time compared to the traffic light system making it the clear winner and demonstrating the potential of ML-based traffic control.

    My thesis was globally recognized by the Global Undergraduate Awards winning the Thomas Clarkson Bronze Medal in Computer Science.
    `,
    techStack: [
      'Unity',
      'TensorFlow',
      'C#',
      'Post Proximal Optimization (PPO)',
      'Machine Learning Agents',
    ],
    links: [
      { label: 'Report', url: 'https://drive.google.com/file/d/16R20QaSgbU64xqaQyiQ4l1Dze7kAHqGw/view?usp=sharing' },
      { label: 'Presentation', url: 'https://docs.google.com/presentation/d/1bEtmEk9Q6Xy9qPy_o7LtMInBb8oE7PMQ/present' },
    ],
    gallery: [
      'assets/images/Master AI.mp4',
      'assets/images/ThesisPresentationTitleSlide.png',
      'assets/images/ThesisPresentationSlide2.png',
      'assets/images/ThesisPresentationSlide11.png',
      'assets/images/IntersectionSensors.png',
      'assets/images/CarSensors.png',

    ]
  },
];

