"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAdminUi } from "./provider";

const MESSAGES: Record<string, string> = {
  created: "Saved as a draft. It is private until you publish it.",
  published: "Published. It is now live on the public website.",
};

/** One-time toast after redirects (e.g. after creating an item); strips the param so it does not repeat. */
export function Notice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useAdminUi();
  const notice = params.get("notice");

  useEffect(() => {
    if (notice && MESSAGES[notice]) {
      toast("success", MESSAGES[notice]);
      router.replace(pathname, { scroll: false });
    }
  }, [notice, pathname, router, toast]);

  return null;
}
