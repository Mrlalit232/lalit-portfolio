import type { NavItem } from "./types";

export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Experience", href: "/experience" },
  { label: "Projects", href: "/projects" },
  { label: "Skills", href: "/skills" },
  { label: "Services", href: "/services" },
  { label: "Ventures", href: "/ventures" },
  { label: "Contact", href: "/contact" },
];

export const resumeNav: NavItem = { label: "Resume", href: "/resume" };

export const footerNav: NavItem[] = [...primaryNav, resumeNav];
