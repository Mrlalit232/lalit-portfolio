// Loaded lazily by <LazyMotion> in motion.tsx so animation code stays off the critical rendering path.
// domMax (not domAnimation) because the header's active-link indicator uses layoutId.
import { domMax } from "motion/react";

export default domMax;
