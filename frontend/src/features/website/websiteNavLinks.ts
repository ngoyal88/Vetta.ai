export type WebsiteNavLink = {
  label: string;
  href: string;
  isRoute?: boolean;
};

export const WEBSITE_NAV_LINKS: WebsiteNavLink[] = [
  { label: 'Platform', href: '/#platform', isRoute: true },
  { label: 'Intelligence', href: '/#intelligence', isRoute: true },
  { label: 'AI Interview', href: '/#ai-interview', isRoute: true },
  { label: 'Pricing', href: '/pricing', isRoute: true },
  { label: 'Contact', href: '/contact', isRoute: true },
];
