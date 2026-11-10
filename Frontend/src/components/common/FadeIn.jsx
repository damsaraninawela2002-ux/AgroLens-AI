import { useEffect, useRef, useState } from "react";

export default function FadeIn({ children, delay = 0, className = "" }) {
  const supportsObserver =
    typeof window !== "undefined" && "IntersectionObserver" in window;
  const [isVisible, setIsVisible] = useState(!supportsObserver);
  const ref = useRef(null);

  useEffect(() => {
    if (!supportsObserver) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [supportsObserver]);

  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={`${isVisible ? "animate-fade-in-up" : "opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}
