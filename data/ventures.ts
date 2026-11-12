import type { Venture } from "./types";

/**
 * Entrepreneurial initiatives. Status labels are deliberate: only the first
 * is active work; the others are concepts. No revenue, customers or public
 * launch is claimed for any of them.
 */
export const ventures: Venture[] = [
  {
    id: "website-development-business",
    name: "Website Development Business",
    status: "Early-stage / In progress",
    stage: "active",
    tagline: "Website development and digital solutions for businesses.",
    summary:
      "I am building a business that provides website development and digital solutions to businesses. It is an ongoing, early-stage entrepreneurial initiative.",
    listTitle: "Services",
    items: [
      "Business Website Development",
      "Portfolio Websites",
      "Landing Pages",
      "Website Design and Development",
      "Digital Presence Solutions",
    ],
    note: "Early-stage work in progress. See the Services page for how I work with clients.",
    link: { label: "View services", href: "/services" },
  },
  {
    id: "business-solutions-platform",
    name: "Business Solutions Platform",
    status: "Concept / Planning",
    stage: "concept",
    tagline: "A service-mediator platform connecting clients with professional service providers.",
    summary:
      "A planned platform that would sit between clients who need a service and the professional providers who can deliver it, collecting requirements and handling quotations.",
    listTitle: "Proposed features",
    items: [
      "Client registration and login",
      "Service provider listings",
      "Basic, Advanced and Premium service categories",
      "Client requirement collection",
      "Admin and client dashboards",
    ],
    secondaryTitle: "Proposed business model",
    secondaryItems: [
      "Quotation turnaround target of 8–24 hours",
      "Proposed business margin of approximately 15–30%",
    ],
    note: "These are proposed features and business-model decisions. This is not an operational platform.",
  },
  {
    id: "business-collaboration-ecosystem",
    name: "Business Collaboration Ecosystem",
    status: "Exploration / Concept",
    stage: "concept",
    tagline: "An idea for connecting businesses and professional services.",
    summary:
      "A broader idea focused on connecting businesses, creating collaboration opportunities, and helping businesses discover professional services and partnerships.",
    listTitle: "Focus areas",
    items: [
      "Connecting businesses with each other",
      "Creating collaboration opportunities",
      "Helping businesses discover professional services",
      "Helping businesses discover partnerships",
    ],
    note: "At the exploration stage. No product or public launch exists.",
  },
];
