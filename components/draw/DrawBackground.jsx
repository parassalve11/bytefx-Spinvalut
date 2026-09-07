"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import background from "@/assets/background/background.webp";

export default function DrawBackground({ phase }) {
  const reduced = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 35, damping: 25 });
  const y = useSpring(pointerY, { stiffness: 35, damping: 25 });

  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (event) => {
      pointerX.set((event.clientX / window.innerWidth - 0.5) * 16);
      pointerY.set((event.clientY / window.innerHeight - 0.5) * 12);
    };
    const reset = () => { pointerX.set(0); pointerY.set(0); };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [reduced, pointerX, pointerY]);

  return (
    <div className="draw-background" data-phase={phase} aria-hidden="true">
      <motion.div className="arena-image" style={{ x: reduced ? 0 : x, y: reduced ? 0 : y }}>
        <Image src={background} alt="" fill priority sizes="100vw" quality={80} className="object-cover object-center" />
      </motion.div>
      <div className="arena-shade" />
      <div className="arena-glow" />
      <div className="arena-vignette" />
    </div>
  );
}
