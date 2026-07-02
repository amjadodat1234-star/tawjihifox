import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, mass: 0.4 });
  return (
    <motion.div
      style={{ scaleX, transformOrigin: "right" }}
      className="fixed top-0 left-0 right-0 z-[60] h-[3px] gradient-anim pointer-events-none"
    />
  );
}
