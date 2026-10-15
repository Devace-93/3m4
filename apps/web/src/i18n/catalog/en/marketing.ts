/**
 * Marketing pages: landing, blog (chrome only, post bodies stay in
 * src/content/posts.ts), pricing/info, sponsors, projects, early-access banner.
 * Prefix keys by page: `landing.*`, `blog.*`, `pricing.*`, `info.*`,
 * `sponsors.*`, `projects.*`, `early.*`, `building.*`.
 * Strings that wrap markup are split into parts (e.g. `*Title` + `*Body`,
 * `*Text` + `*Link`); the page re-assembles them around the element.
 */
export const marketing = {
  // Landing — hero
  "landing.badge": "Open source · MIT · Self-hostable",
  "landing.heroTitle": "Short links with",
  "landing.heroTitleAccent": "real click analytics",
  "landing.heroBody":
    "3m4 turns long URLs into tidy short links and shows you exactly who clicks — geo, device, and referrer breakdowns, QR codes, and a public API. Hosted by us, or self-host the whole thing.",
  "landing.getStarted": "Get started free",
  "landing.whyFree": "Why it's free right now",
  "landing.seePricing": "See pricing",
  "landing.earlyNote": "Early access: every account gets full access, free. Plans come later, with notice.",
  "landing.freeNote": "Free plan: {links} links & {clicks} tracked clicks / month. No card required.",

  // Landing — features
  "landing.featuresTitle": "Everything you need to share & measure links",
  "landing.feature1Title": "Short codes",
  "landing.feature1Body": "Random base62 codes on 3m4.net, or custom vanity slugs like 3m4.net/launch.",
  "landing.feature2Title": "Custom domains",
  "landing.feature2Body": "Bring your own domain with automatic TLS so links stay on-brand.",
  "landing.feature3Title": "301 / 302 redirects",
  "landing.feature3Body": "302 by default for accurate analytics; flip any link to a permanent 301.",
  "landing.feature4Title": "Click analytics",
  "landing.feature4Body": "Time-series, plus breakdowns by country, device, and referrer — no raw IPs stored.",
  "landing.feature5Title": "QR codes",
  "landing.feature5Body": "Every link ships with a downloadable QR code, generated on demand.",
  "landing.feature6Title": "Public API",
  "landing.feature6Body": "Create and manage links programmatically with role-scoped API keys.",
  "landing.feature7Title": "MCP server for AI agents",
  "landing.feature7Body":
    "Claude Code, Cursor or any MCP host can shorten links and read analytics for you, with roles, confirmations and an audit log.",

  // Landing — MCP section
  "landing.mcpBadge": "New · Model Context Protocol",
  "landing.mcpTitle": "Let your AI agent manage links",
  "landing.mcpIntro":
    "3m4 ships an MCP server. Connect it to Claude Code, Claude Desktop, Cursor or any MCP host and ask things like",
  "landing.mcpExample1": "“shorten this URL and give me the QR”",
  "landing.mcpOr": "or",
  "landing.mcpExample2": "“which of my links got the most clicks this month?”",
  "landing.mcpBullet1Title": "Role-scoped keys.",
  "landing.mcpBullet1Body":
    "A viewer key never even sees the delete tool; editor and admin unlock more. Enforced by the API too.",
  "landing.mcpBullet2Title": "Human in the loop.",
  "landing.mcpBullet2Body": "Destructive actions ask you to confirm before anything happens.",
  "landing.mcpBullet3Title": "Audit trail.",
  "landing.mcpBullet3Body": "Every change and every refused call is logged, server-side and agent-side.",
  "landing.mcpBullet4Title": "Local or remote.",
  "landing.mcpBullet4Body1": "Run it over stdio with",
  "landing.mcpBullet4Npm": "npm",
  "landing.mcpBullet4Body2": "or point your host at",
  "landing.mcpBullet4Body3": "with your key.",
  "landing.mcpPanelLocal": "Claude Code · local (npm)",
  "landing.mcpPanelRemote": "Claude Code · remote (nothing to install)",
  "landing.mcpPanelJson": "Any MCP host (JSON)",
  "landing.mcpKeyNote": "Create a key with the role you want under",
  "landing.mcpKeyLink": "Dashboard → API keys",

  // Landing — self-host callout
  "landing.selfhostTitle": "Self-host it (MIT, open source)",
  "landing.selfhostBody1":
    "The entire stack — Flask API, redirect service, worker, and this Qwik app — is MIT-licensed. Run it on your own VPS with one",
  "landing.selfhostBody2": ". No billing code, no limits beyond what you configure.",
  "landing.viewGithub": "View on GitHub",

  // Blog (chrome only)
  "blog.title": "Blog",
  "blog.intro": "Product updates, engineering notes, and link-building tips.",
  "blog.comingSoon": "Coming soon.",
  "blog.readMore": "Read more →",
  "blog.allPosts": "← All posts",
  "blog.notFoundTitle": "Post not found",
  "blog.notFoundBody": "There is no post at",
  "blog.backToBlog": "Back to Blog",
  "blog.seeTiers": "See the planned tiers",

  // Info index
  "info.title": "Info",
  "info.intro": "Reference pages for 3m4. More will land here over time.",
  "info.pricingTitle": "Pricing",
  "info.pricingBody": "Plans, limits, and prices.",
  "info.plannedPricingTitle": "Planned pricing",
  "info.plannedPricingBody": "The tiers we intend to introduce after early access.",
  "info.docsTitle": "Docs",
  "info.docsBody": "Guides and API reference (coming soon).",
  "info.termsTitle": "Terms",
  "info.termsBody": "Terms of service (coming soon).",
  "info.privacyTitle": "Privacy",
  "info.privacyBody": "We never store raw IPs (coming soon).",
  "info.comingSoon": "This page is coming soon.",
  "info.backToInfo": "Back to Info",

  // Pricing page
  "pricing.title": "Simple, honest pricing",
  "pricing.titlePlanned": "Planned pricing",
  "pricing.intro":
    "Start free. Upgrade when you need more links, clicks, domains, or longer retention. Self-host for unlimited everything.",
  "pricing.introPlanned":
    "These are the tiers we intend to introduce after early access. Nothing here applies yet.",
  "pricing.earlyTitle": "Right now every account has full access, free.",
  "pricing.earlyBody":
    "Unlimited links and tracked clicks, custom slugs, long retention, the API and the MCP server. When plans arrive we will announce it on the blog and by email before any limit applies to an existing account. Prices and limits below may still change.",
  "pricing.earlyCta": "Read what paid plans will include",
  "pricing.enterpriseTitle": "Need custom limits, SSO, or an SLA?",
  "pricing.enterpriseBody": "Enterprise plans are tailored to your team.",
  "pricing.contactUs": "Contact us",
  "pricing.footnote":
    "All prices in USD. Annual billing saves ~20%. Limits are enforced per billing period; over-limit links are blocked, over-limit clicks keep redirecting (we just stop counting).",
  "pricing.footnoteEarly": "None of this is enforced during early access.",

  // Pricing table (plan labels come from packages/shared/plan_limits.json)
  "pricing.mostPopular": "Most popular",
  "pricing.perMonth": "/mo",
  "pricing.perYear": "/yr",
  "pricing.linksPerMonth": "links / mo",
  "pricing.clicksPerMonth": "tracked clicks / mo",
  "pricing.customDomain": "custom domain",
  "pricing.customDomains": "custom domains",
  "pricing.customSlugs": "Custom slugs",
  "pricing.retention": "{value} retention",
  "pricing.user": "user",
  "pricing.users": "users",
  "pricing.api": "{api} API",
  "pricing.sponsorsBadge": "/sponsors badge",
  "pricing.teamExtras": "Roles + priority support",
  "pricing.enterpriseExtras": "SSO, SLA, custom limits",
  "pricing.getStarted": "Get started",
  "pricing.startPlan": "Start {plan}",

  // Sponsors
  "sponsors.title": "Sponsors",
  "sponsors.intro1": "3m4 is open source (MIT). Every",
  "sponsors.introLink": "Pro / Supporter",
  "sponsors.intro2": "subscriber helps keep it free to self-host — and gets a badge and a spot on this page.",
  "sponsors.intro2Early":
    "subscriber will help keep it free to self-host — and will get a badge and a spot on this page.",
  "sponsors.emptyTitle": "Your name could be the first on this page.",
  "sponsors.emptyBody": "Every Pro / Supporter subscriber gets a spot here and an embeddable badge.",
  "sponsors.emptyBodyEarly":
    "Supporter subscriptions open together with paid plans, after early access. Until then every account is free.",
  "sponsors.tierSupporter": "{tier} supporter",
  "sponsors.badgeTitle": "The supporter badge",
  "sponsors.badgeBody": "Pro supporters get an embeddable badge for their site or README:",
  "sponsors.badgeBodyEarly": "Pro supporters will get an embeddable badge for their site or README:",
  "sponsors.badgeLabel": "3m4 Supporter",
  "sponsors.readPlans": "Read about the upcoming plans",
  "sponsors.become": "Become a supporter",

  // Projects
  "projects.title": "Projects",
  "projects.hidden": "This section isn't public yet. Check back soon.",
  "projects.backHome": "Back home",
  "projects.intro": "Things built with 3m4 and around it.",
  "projects.comingSoon": "Coming soon.",
  "projects.fallbackTitle": "Project",
  "projects.backToProjects": "Back to Projects",

  // Early-access banner
  "early.bannerTitle": "Early access.",
  "early.bannerText":
    "Every account has full access at no cost right now. Plans and limits will be introduced later, with notice before anything changes.",
  "early.bannerLink": "What paid plans will include",

  // Site-building curtain
  "building.title": "We're building 3m4",
  "building.body":
    "Short links with privacy-friendly click analytics. The site isn't open yet — but your existing short links keep redirecting just fine.",
  "building.footer": "3m4.net · coming soon",
} as const;
