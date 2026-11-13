// Pure data (no server imports) so client components can use it.
/** Public pages whose SEO can be overridden in the SEO manager. Keys are canonical paths. */
export const SEO_PAGES = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/experience", label: "Experience" },
  { path: "/projects", label: "Projects" },
  { path: "/skills", label: "Skills" },
  { path: "/services", label: "Services" },
  { path: "/ventures", label: "Ventures" },
  { path: "/contact", label: "Contact" },
  { path: "/resume", label: "Resume" },
] as const;
