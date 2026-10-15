/**
 * Blog content. Plain data for now (no CMS, no markdown pipeline): a post is a
 * list of sections rendered by routes/(marketing)/blog/[...slug]. Newest first.
 */
export interface PostSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Post {
  slug: string;
  title: string;
  date: string; // ISO date
  summary: string;
  sections: PostSection[];
}

export const POSTS: Post[] = [
  {
    slug: "what-paid-plans-will-include",
    title: "Early access: everything is free for now. Here is what paid plans will include later.",
    date: "2026-10-14",
    summary:
      "3m4 is in early access. Every account gets the full product at no cost while we finish the pieces that cost real money to run. This post explains what will eventually sit behind paid plans, and what stays free.",
    sections: [
      {
        paragraphs: [
          "3m4 is open source and self-hostable, and the hosted version at 3m4.net is in early access. During early access every account gets the full product: unlimited links, unlimited tracked clicks, custom slugs, long analytics retention, the public API, and the MCP server for AI agents. No card, no trial clock.",
          "We would rather learn what people actually use before drawing lines around it. Plans will come, and this post is the honest preview of where those lines will be.",
        ],
      },
      {
        heading: "What stays free",
        bullets: [
          "Self-hosting. The whole stack is MIT licensed and always will be; a self-hosted instance has no limits beyond the ones you configure.",
          "A free hosted tier with a monthly budget of links and tracked clicks, 302/301 redirects, QR codes, and core analytics (clicks over time, country, device, referrer).",
          "Basic API access with scoped API keys, and the MCP server for AI agents.",
          "Privacy defaults: we never store raw IP addresses, on any plan.",
        ],
      },
      {
        heading: "What will move under paid plans",
        paragraphs: [
          "The things that cost money to run at scale, or that mostly matter to teams and businesses:",
        ],
        bullets: [
          "Higher monthly budgets: more links created and more tracked clicks per month. Over-budget links keep redirecting; we only stop counting.",
          "Custom slugs (vanity codes like 3m4.net/launch) on the hosted edition.",
          "More custom domains with automatic TLS.",
          "Longer analytics retention (a year or more instead of a rolling window).",
          "Team seats, roles and an account-wide audit log.",
          "Full API quota and priority support.",
          "Enterprise: SSO, SLA and custom limits.",
        ],
      },
      {
        heading: "What happens when plans arrive",
        paragraphs: [
          "Links never break. Whatever plan you end up on, every short link you created keeps redirecting.",
          "We will announce the change here and by email before any limit applies to an existing account, with enough notice to export your data or pick a plan.",
          "The planned tiers are already listed on the pricing page so there are no surprises. Prices and limits there are our current intent, not a contract, and may still change before launch.",
        ],
      },
      {
        heading: "Questions or opinions?",
        paragraphs: [
          "Early access exists to collect them. Open an issue on GitHub or reply to the welcome email. Telling us which of the items above you would pay for, and which you would not, directly shapes the final plans.",
        ],
      },
    ],
  },
];

export function findPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
