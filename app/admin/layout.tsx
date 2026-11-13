import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Admin" },
  robots: { index: false, follow: false },
};

// Applies the saved admin theme before first paint (no flash). Dark is the default.
const themeScript = `try{var t=localStorage.getItem("admin-theme");document.documentElement.dataset.adminTheme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.adminTheme="dark"}`;

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-scope min-h-screen bg-ink-950 text-fg">
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </div>
  );
}
