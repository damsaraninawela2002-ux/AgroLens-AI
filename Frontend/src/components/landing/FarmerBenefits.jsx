import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  History,
  Layers,
  MessageCircle,
  ScanSearch,
  Smartphone,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";
import Badge from "../ui/Badge";
import Logo from "../ui/Logo";
import { useLanguage } from "../../context/LanguageContext";

const STAGGER_SECONDS = 0.38;
const BASE_DELAY = 0.12;

export default function FarmerBenefits() {
  const { t } = useLanguage();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const prefersReducedMotion = useReducedMotion();

  // Ordered top-to-bottom in visual display (Card 1 at top under the cap, Card 6 at bottom)
  // dropOrder 0 lands first at the bottom, dropOrder 5 lands last right below the cap
  const cardsTopToBottom = [
    {
      id: "phone",
      dropOrder: 5,
      category: t("farmerBenefits.cards.phone.label"),
      name: t("farmerBenefits.cards.phone.title"),
      role: t("farmerBenefits.cards.phone.desc"),
      tags: [
        t("farmerBenefits.cards.phone.tag1"),
        t("farmerBenefits.cards.phone.tag2"),
      ],
      Icon: Smartphone,
      iconColor: "text-[#087EA4]",
      tileBg: "bg-sky-500/10 border-sky-300/50",
      entryX: 26,
      entryRotate: 5,
    },
    {
      id: "advice",
      dropOrder: 4,
      category: t("farmerBenefits.cards.advice.label"),
      name: t("farmerBenefits.cards.advice.title"),
      role: t("farmerBenefits.cards.advice.desc"),
      tags: [
        t("farmerBenefits.cards.advice.tag1"),
        t("farmerBenefits.cards.advice.tag2"),
      ],
      Icon: MessageCircle,
      iconColor: "text-[#4E75F6]",
      tileBg: "bg-indigo-500/10 border-indigo-300/50",
      entryX: -28,
      entryRotate: -7,
    },
    {
      id: "visual",
      dropOrder: 3,
      category: t("farmerBenefits.cards.visual.label"),
      name: t("farmerBenefits.cards.visual.title"),
      role: t("farmerBenefits.cards.visual.desc"),
      tags: [
        t("farmerBenefits.cards.visual.tag1"),
        t("farmerBenefits.cards.visual.tag2"),
      ],
      Icon: ScanSearch,
      iconColor: "text-[#dc2626]",
      tileBg: "bg-red-500/10 border-red-300/50",
      entryX: 28,
      entryRotate: 6,
    },
    {
      id: "fast",
      dropOrder: 2,
      category: t("farmerBenefits.cards.fast.label"),
      name: t("farmerBenefits.cards.fast.title"),
      role: t("farmerBenefits.cards.fast.desc"),
      tags: [
        t("farmerBenefits.cards.fast.tag1"),
        t("farmerBenefits.cards.fast.tag2"),
      ],
      Icon: Zap,
      iconColor: "text-[#FF6F00]",
      tileBg: "bg-[#FF6F00]/10 border-[#FF6F00]/25",
      entryX: -26,
      entryRotate: -5,
    },
    {
      id: "officer",
      dropOrder: 1,
      category: t("farmerBenefits.cards.officer.label"),
      name: t("farmerBenefits.cards.officer.title"),
      role: t("farmerBenefits.cards.officer.desc"),
      tags: [
        t("farmerBenefits.cards.officer.tag1"),
        t("farmerBenefits.cards.officer.tag2"),
      ],
      Icon: UserCheck,
      iconColor: "text-[#009688]",
      tileBg: "bg-[#009688]/10 border-[#009688]/25",
      entryX: 30,
      entryRotate: 6,
    },
    {
      id: "records",
      dropOrder: 0,
      category: t("farmerBenefits.cards.records.label"),
      name: t("farmerBenefits.cards.records.title"),
      role: t("farmerBenefits.cards.records.desc"),
      tags: [
        t("farmerBenefits.cards.records.tag1"),
        t("farmerBenefits.cards.records.tag2"),
      ],
      Icon: History,
      iconColor: "text-[#00684A]",
      tileBg: "bg-[#00ED64]/12 border-[#00ED64]/30",
      entryX: -28,
      entryRotate: -6,
    },
  ];

  const capDropOrder = cardsTopToBottom.length; // 6
  const capDropDelay = BASE_DELAY + capDropOrder * STAGGER_SECONDS;
  const pulseDelay = capDropDelay + 0.55;
  const idleStartDelay = pulseDelay + 0.65;

  const shouldAnimate = !prefersReducedMotion;

  const checklistFacts = [
    t("farmerBenefits.fact1"),
    t("farmerBenefits.fact2"),
    t("farmerBenefits.fact3"),
    t("farmerBenefits.fact4"),
  ];

  return (
    <section
      ref={sectionRef}
      id="farmer-benefits"
      className="relative py-16 lg:py-24 bg-[#f8faf5] border-b border-slate-200/80 overflow-hidden"
    >
      {/* Very faint green radial glow behind the stack */}
      <div
        className="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[#166534]/[0.05] blur-3xl"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* ================= LEFT COLUMN: HEADING & FARMER HIGHLIGHTS ================= */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <Badge variant="lime" icon={Layers}>
              {t("farmerBenefits.sectionBadge")}
            </Badge>

            <h2 className="font-extrabold tracking-tight text-slate-900 text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.12]">
              {t("farmerBenefits.titlePrefix")}{" "}
              <span className="text-[#166534]">
                {t("farmerBenefits.titleAccent")}
              </span>
            </h2>

            <p className="text-base text-slate-600 leading-relaxed max-w-[36rem]">
              {t("farmerBenefits.subtitle")}
            </p>

            {/* 4 Farmer Facts Checklist */}
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
          </div>

          {/* ================= RIGHT COLUMN: THE 6 FARMER CARDS ================= */}
          <div className="lg:col-span-7 w-full">
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
              {/* Subtle Connecting Line on Left Edge (Desktop/Tablet only) */}
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
                {/* ================= TOP CAP: AGROLENS AI + "FOR FARMERS" BADGE ================= */}
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
                  {/* Node dot for Top Cap */}
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
                      <span>{t("farmerBenefits.platformLabel")}</span>
                    </span>
                  </div>
                </motion.div>

                {/* ================= 6 FARMER BENEFIT CARDS ================= */}
                {cardsTopToBottom.map((layer) => {
                  const layerDelay =
                    BASE_DELAY + layer.dropOrder * STAGGER_SECONDS;
                  const IconComp = layer.Icon;

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
                      {/* Node dot on left connecting line */}
                      <span
                        aria-hidden="true"
                        className="hidden sm:block absolute -left-[21px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-[#16a34a] group-hover:scale-125 group-hover:bg-[#84cc16] transition-transform"
                      />

                      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                        {/* Left: 44px Icon Tile + Label, Title & Description */}
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl border ${layer.tileBg} shrink-0 flex items-center justify-center`}
                          >
                            <IconComp
                              className={`w-6 h-6 ${layer.iconColor}`}
                              aria-hidden="true"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#166534]">
                                {layer.category}
                              </span>
                            </div>

                            <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-snug">
                              {layer.name}
                            </h3>

                            <p className="text-sm text-slate-500 group-hover:text-slate-700 leading-snug transition-colors">
                              {layer.role}
                            </p>
                          </div>
                        </div>

                        {/* Right: Grey Tag Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 pl-14 sm:pl-0 sm:justify-end shrink-0">
                          {layer.tags.map((tag) => (
                            <span
                              key={tag}
                              className="font-mono text-[11px] font-medium px-2.5 py-1 h-auto rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 leading-[1.7] whitespace-normal break-words"
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
