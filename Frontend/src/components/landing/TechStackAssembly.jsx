import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  SiMongodb,
  SiFastapi,
  SiTensorflow,
  SiGooglegemini,
  SiReact,
  SiVite,
  SiTailwindcss,
} from "react-icons/si";
import { CheckCircle2, Layers, ScanEye, Sparkles } from "lucide-react";
import Badge from "../ui/Badge";
import Logo from "../ui/Logo";
import { useLanguage } from "../../context/LanguageContext";
import api from "../../services/api";

const STAGGER_SECONDS = 0.38;
const BASE_DELAY = 0.12;

export default function TechStackAssembly() {
  const { t } = useLanguage();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const prefersReducedMotion = useReducedMotion();

  const [modelStats, setModelStats] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveModelStats() {
      try {
        const response = await api.get("/api/model/info");
        const data = response?.data;
        const rawAccuracy = data?.metrics?.test_accuracy;
        const classNames = data?.class_names;

        if (
          typeof rawAccuracy === "number" &&
          !Number.isNaN(rawAccuracy) &&
          Array.isArray(classNames) &&
          classNames.length > 0
        ) {
          const normalizedPct =
            rawAccuracy <= 1 ? rawAccuracy * 100 : rawAccuracy;
          if (isMounted) {
            setModelStats({
              accuracyPercent: normalizedPct.toFixed(1),
              numClasses: classNames.length,
            });
          }
        }
      } catch {
        // Hide live stat chips silently if the API is unreachable
        if (isMounted) {
          setModelStats(null);
        }
      }
    }

    fetchLiveModelStats();
    return () => {
      isMounted = false;
    };
  }, []);

  // Ordered bottom-to-top (dropOrder 0 lands first at the bottom, dropOrder 5 lands last right below the cap)
  const layersBottomToTop = [
    {
      id: "mongodb",
      dropOrder: 0,
      category: t("techStack.categories.data"),
      name: "MongoDB Atlas",
      role: t("techStack.layers.mongodb"),
      tags: ["Motor", "Indexes"],
      icons: [{ Component: SiMongodb, color: "text-[#00684A]" }],
      tileBg: "bg-[#00ED64]/12 border-[#00ED64]/30",
      entryX: -28,
      entryRotate: -6,
    },
    {
      id: "fastapi",
      dropOrder: 1,
      category: t("techStack.categories.api"),
      name: "FastAPI",
      role: t("techStack.layers.fastapi"),
      tags: ["Python", "JWT", "Pydantic"],
      icons: [{ Component: SiFastapi, color: "text-[#009688]" }],
      tileBg: "bg-[#009688]/10 border-[#009688]/25",
      entryX: 30,
      entryRotate: 6,
    },
    {
      id: "tensorflow",
      dropOrder: 2,
      category: t("techStack.categories.model"),
      name: "TensorFlow + MobileNetV2",
      role: t("techStack.layers.tensorflow"),
      tags: ["Keras", "Transfer learning", "Colab"],
      icons: [{ Component: SiTensorflow, color: "text-[#FF6F00]" }],
      tileBg: "bg-[#FF6F00]/10 border-[#FF6F00]/25",
      entryX: -26,
      entryRotate: -5,
    },
    {
      id: "gradcam",
      dropOrder: 3,
      category: t("techStack.categories.explainability"),
      name: "Grad-CAM",
      role: t("techStack.layers.gradcam"),
      tags: ["Heatmaps", "XAI"],
      icons: [{ Component: ScanEye, color: "text-[#dc2626]" }],
      tileBg: "bg-red-500/10 border-red-300/50",
      entryX: 28,
      entryRotate: 6,
    },
    {
      id: "gemini",
      dropOrder: 4,
      category: t("techStack.categories.advisory"),
      name: "Gemini API",
      role: t("techStack.layers.gemini"),
      tags: ["GenAI", "Context-aware"],
      icons: [{ Component: SiGooglegemini, color: "text-[#4E75F6]" }],
      tileBg: "bg-indigo-500/10 border-indigo-300/50",
      entryX: -28,
      entryRotate: -7,
    },
    {
      id: "frontend",
      dropOrder: 5,
      category: t("techStack.categories.interface"),
      name: "React + Vite + Tailwind CSS",
      role: t("techStack.layers.frontend"),
      tags: ["Recharts", "Framer Motion"],
      icons: [
        { Component: SiReact, color: "text-[#087EA4]" },
        { Component: SiVite, color: "text-[#646CFF]" },
        { Component: SiTailwindcss, color: "text-[#06B6D4]" },
      ],
      tileBg: "bg-sky-500/10 border-sky-300/50",
      entryX: 26,
      entryRotate: 5,
    },
  ];

  // Visual display is top-to-bottom so Layer 6 (Interface) is directly under the Cap and Layer 1 (Data) is at the bottom
  const visualLayers = [...layersBottomToTop].reverse();

  const capDropOrder = layersBottomToTop.length; // 6
  const capDropDelay = BASE_DELAY + capDropOrder * STAGGER_SECONDS;
  const pulseDelay = capDropDelay + 0.55;
  const idleStartDelay = pulseDelay + 0.65;

  const shouldAnimate = !prefersReducedMotion;

  const checklistFacts = [
    t("techStack.fact1"),
    t("techStack.fact2"),
    t("techStack.fact3"),
    t("techStack.fact4"),
  ];

  return (
    <section
      ref={sectionRef}
      id="tech-stack"
      className="relative py-16 lg:py-24 bg-[#f8faf5] border-b border-slate-200/80 overflow-hidden"
    >
      {/* Very faint green radial glow behind the stack */}
      <div
        className="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[#166534]/[0.05] blur-3xl"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* ================= LEFT COLUMN: HEADING, FACTS & LIVE MODEL CHIPS ================= */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <Badge variant="lime" icon={Layers}>
              {t("techStack.sectionBadge")}
            </Badge>

            <h2 className="font-extrabold tracking-tight text-slate-900 text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.12]">
              {t("techStack.titlePrefix")}{" "}
              <span className="text-[#166534]">
                {t("techStack.titleAccent")}
              </span>
            </h2>

            <p className="text-base text-slate-600 leading-relaxed max-w-[36rem]">
              {t("techStack.subtitle")}
            </p>

            {/* 4 Project Facts Checklist */}
            <ul className="space-y-3 pt-1">
              {checklistFacts.map((fact, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm sm:text-[15px] text-slate-700 leading-snug"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>

            {/* Live Stat Chips loaded from GET /api/model/info (hidden if API fails) */}
            {modelStats && (
              <div className="pt-2 grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="rounded-xl bg-white border border-slate-200/80 px-3 py-2.5 shadow-xs">
                  <p className="font-mono text-base sm:text-lg font-semibold text-[#166534] leading-tight">
                    {modelStats.accuracyPercent}%
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    {t("techStack.statAccuracyLabel")}
                  </p>
                </div>

                <div className="rounded-xl bg-white border border-slate-200/80 px-3 py-2.5 shadow-xs">
                  <p className="font-mono text-base sm:text-lg font-semibold text-slate-900 leading-tight">
                    {modelStats.numClasses}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    {t("techStack.statClassesLabel")}
                  </p>
                </div>

                <div className="rounded-xl bg-white border border-slate-200/80 px-3 py-2.5 shadow-xs">
                  <p className="font-mono text-sm sm:text-base font-semibold text-slate-900 leading-tight">
                    {t("techStack.statCropsValue")}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight truncate">
                    {t("techStack.statCropsSub")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ================= RIGHT COLUMN: THE STACK ASSEMBLY ================= */}
          <div className="lg:col-span-7 w-full">
            {/* Idle Floating Wrapper (transform-only) */}
            <motion.div
              animate={
                shouldAnimate && isInView ? { y: [0, -5, 0] } : { y: 0 }
              }
              transition={
                shouldAnimate
                  ? {
                      delay: idleStartDelay,
                      duration: 4.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  : undefined
              }
              className="relative max-w-2xl mx-auto w-full sm:pl-6"
            >
              {/* Subtle Data-Flow Connecting Line on Left Edge (Desktop/Tablet only, hidden on 375px mobile) */}
              <motion.div
                aria-hidden="true"
                initial={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
                animate={
                  shouldAnimate
                    ? isInView
                      ? { opacity: 1 }
                      : { opacity: 0 }
                    : { opacity: 1 }
                }
                transition={{
                  delay: shouldAnimate ? pulseDelay : 0,
                  duration: 0.6,
                }}
                className="hidden sm:block pointer-events-none absolute left-1.5 top-8 bottom-8 w-[2px] rounded-full bg-gradient-to-t from-[#166534]/35 via-[#22c55e]/60 to-[#84cc16]"
              />

              {/* Whole-Stack Subtle Green Glow Pulse when Top Cap Lands */}
              {shouldAnimate && (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={
                    isInView
                      ? {
                          opacity: [0, 0.7, 0],
                          scale: [0.98, 1.02, 1],
                        }
                      : { opacity: 0, scale: 0.97 }
                  }
                  transition={{
                    delay: pulseDelay,
                    duration: 0.9,
                    ease: "easeOut",
                  }}
                  className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-b from-[#84cc16]/25 via-[#22c55e]/20 to-[#166534]/20 blur-xl z-0"
                />
              )}

              <div className="relative z-10 flex flex-col gap-2.5">
                {/* ================= TOP CAP: AGROLENS AI + SINGLE PLATFORM BADGE ================= */}
                <motion.div
                  initial={
                    shouldAnimate
                      ? {
                          opacity: 0,
                          y: -130,
                          x: -22,
                          rotate: -7,
                          scaleX: 0.95,
                          scaleY: 1.05,
                        }
                      : {
                          opacity: 1,
                          y: 0,
                          x: 0,
                          rotate: 0,
                          scaleX: 1,
                          scaleY: 1,
                        }
                  }
                  animate={
                    shouldAnimate
                      ? isInView
                        ? {
                            opacity: [0, 1, 1, 1],
                            y: [-130, 5, -2, 0],
                            x: [-22, 2, 0, 0],
                            rotate: [-7, 1.2, -0.4, 0],
                            scaleX: [0.95, 1.03, 0.99, 1],
                            scaleY: [1.05, 0.96, 1.01, 1],
                          }
                        : {
                            opacity: 0,
                            y: -130,
                            x: -22,
                            rotate: -7,
                            scaleX: 0.95,
                            scaleY: 1.05,
                          }
                      : {
                          opacity: 1,
                          y: 0,
                          x: 0,
                          rotate: 0,
                          scaleX: 1,
                          scaleY: 1,
                        }
                  }
                  transition={{
                    delay: shouldAnimate ? capDropDelay : 0,
                    duration: 0.65,
                    times: [0, 0.65, 0.85, 1],
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileHover={
                    shouldAnimate
                      ? {
                          y: -2,
                          scale: 1.008,
                          transition: {
                            type: "spring",
                            stiffness: 380,
                            damping: 24,
                          },
                        }
                      : undefined
                  }
                  className="relative rounded-t-[2rem] rounded-b-2xl bg-gradient-to-r from-[#052e16] via-[#166534] to-[#15803d] text-white px-4 py-3.5 sm:px-5 sm:py-4 shadow-md shadow-[#166534]/15 border border-[#84cc16]/35"
                >
                  {/* Data-flow node dot for Top Cap (Desktop/Tablet) */}
                  <span
                    aria-hidden="true"
                    className="hidden sm:block absolute -left-[22px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#84cc16] ring-4 ring-[#f8faf5]"
                  />

                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <Logo
                      variant="light"
                      size="sm"
                      to={null}
                      showSubtitle={false}
                    />

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#84cc16]/20 text-[#a3e635] border border-[#84cc16]/40 whitespace-nowrap">
                      <Sparkles
                        className="w-3 h-3 text-[#a3e635] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{t("techStack.platformLabel")}</span>
                    </span>
                  </div>
                </motion.div>

                {/* ================= 6 TECH STACK LAYERS ================= */}
                {visualLayers.map((layer) => {
                  const layerDelay =
                    BASE_DELAY + layer.dropOrder * STAGGER_SECONDS;
                  const isMultiIcon = layer.icons.length > 1;

                  return (
                    <motion.div
                      key={layer.id}
                      initial={
                        shouldAnimate
                          ? {
                              opacity: 0,
                              y: -120,
                              x: layer.entryX,
                              rotate: layer.entryRotate,
                              scaleX: 0.95,
                              scaleY: 1.05,
                            }
                          : {
                              opacity: 1,
                              y: 0,
                              x: 0,
                              rotate: 0,
                              scaleX: 1,
                              scaleY: 1,
                            }
                      }
                      animate={
                        shouldAnimate
                          ? isInView
                            ? {
                                opacity: [0, 1, 1, 1],
                                y: [-120, 4, -2, 0],
                                x: [layer.entryX, -layer.entryX * 0.08, 0, 0],
                                rotate: [
                                  layer.entryRotate,
                                  -layer.entryRotate * 0.2,
                                  0.3,
                                  0,
                                ],
                                scaleX: [0.95, 1.025, 0.995, 1],
                                scaleY: [1.05, 0.965, 1.005, 1],
                              }
                            : {
                                opacity: 0,
                                y: -120,
                                x: layer.entryX,
                                rotate: layer.entryRotate,
                                scaleX: 0.95,
                                scaleY: 1.05,
                              }
                          : {
                              opacity: 1,
                              y: 0,
                              x: 0,
                              rotate: 0,
                              scaleX: 1,
                              scaleY: 1,
                            }
                      }
                      transition={{
                        delay: shouldAnimate ? layerDelay : 0,
                        duration: 0.62,
                        times: [0, 0.65, 0.85, 1],
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      whileHover={
                        shouldAnimate
                          ? {
                              y: -2,
                              scale: 1.01,
                              transition: {
                                type: "spring",
                                stiffness: 400,
                                damping: 25,
                              },
                            }
                          : undefined
                      }
                      className="group relative min-h-[82px] flex items-center rounded-2xl bg-white border border-slate-200/70 hover:border-[#166534]/40 px-4 py-3 sm:px-5 sm:py-3.5 shadow-xs hover:shadow-md shadow-slate-900/[0.03] transition-colors duration-200"
                    >
                      {/* Data-flow node dot on left connecting line (Desktop/Tablet) */}
                      <span
                        aria-hidden="true"
                        className="hidden sm:block absolute -left-[21px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-[#16a34a] group-hover:scale-125 group-hover:bg-[#84cc16] transition-transform"
                      />

                      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                        {/* Left: 44px Icon Tile + Category, Name & Description */}
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          {/* Consistent 44x44px (w-11 h-11) Icon Tile */}
                          <div
                            className={`w-11 h-11 rounded-xl border ${layer.tileBg} shrink-0 flex items-center justify-center`}
                          >
                            {isMultiIcon ? (
                              <div className="grid grid-cols-2 gap-0.5 place-items-center p-1">
                                {layer.icons.map((ic, idx) => {
                                  const IconComp = ic.Component;
                                  return (
                                    <IconComp
                                      key={idx}
                                      className={`w-3.5 h-3.5 ${ic.color} ${
                                        idx === 2 ? "col-span-2" : ""
                                      }`}
                                      aria-hidden="true"
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              layer.icons.map((ic, idx) => {
                                const IconComp = ic.Component;
                                return (
                                  <IconComp
                                    key={idx}
                                    className={`w-5 h-5 ${ic.color}`}
                                    aria-hidden="true"
                                  />
                                );
                              })
                            )}
                          </div>

                          <div className="min-w-0">
                            {/* Category label above name in JetBrains Mono */}
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#166534]">
                                {layer.category}
                              </span>
                              {layer.badge && (
                                <Badge
                                  variant="warning"
                                  className="!px-2 !py-0 !text-[10px]"
                                >
                                  {layer.badge}
                                </Badge>
                              )}
                            </div>

                            <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-snug">
                              {layer.name}
                            </h3>

                            <p className="text-sm text-slate-500 group-hover:text-slate-700 leading-snug transition-colors">
                              {layer.role}
                            </p>
                          </div>
                        </div>

                        {/* Right: Monospace Tech Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pl-14 sm:pl-0 sm:justify-end shrink-0">
                          {layer.tags.map((tag) => (
                            <span
                              key={tag}
                              className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
