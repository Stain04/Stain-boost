import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Blog: one Markdown file per post in src/content/blog/<slug>.md.
// The file name is the URL: /blog/<slug>. Index, sitemap, schema and OG image are automatic.
const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),                 // <title> / search result title
    h1: z.string(),                    // headline on the page
    description: z.string(),           // meta description (≈150 chars)
    category: z.string(),
    excerpt: z.string(),               // blog card text
    emoji: z.string().default('📘'),   // blog card icon
    readTime: z.string(),              // e.g. "7 min read"
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    order: z.number().default(99),     // lower = earlier on the blog index
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
