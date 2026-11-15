import {
  Marquee,
  MarqueeContent,
  MarqueeItem,
} from "@notra/ui/components/kibo-ui/marquee";

import {
  MARQUEE_CAPTION,
  MARQUEE_EDGE_MASK,
  MARQUEE_LOGOS,
} from "@/constants/landing/marquee-quote";

export function LogoMarquee() {
  return (
    <section className="flex flex-col items-center gap-8 px-6 pt-14 pb-8 antialiased sm:gap-12 sm:px-12 sm:pt-16 sm:pb-12 lg:px-20 lg:pt-20 lg:pb-13">
      <p className="font-display text-center text-sm/5 font-medium tracking-[-0.01em] text-[#1E1E1EB3] sm:text-base/6 dark:text-white/50">
        {MARQUEE_CAPTION}
      </p>
      <Marquee
        className="text-[#6B7280] dark:text-[#9CA3AF] focus-within:[&_.rfm-marquee]:[animation-play-state:paused]!"
        style={{
          maskImage: MARQUEE_EDGE_MASK,
          WebkitMaskImage: MARQUEE_EDGE_MASK,
        }}
      >
        <MarqueeContent pauseOnHover={false} speed={40}>
          {MARQUEE_LOGOS.map(({ name, label, Logo, href }) => (
            <MarqueeItem className="mx-8 sm:mx-14 lg:mx-22.25" key={name}>
              {href ? (
                <a
                  aria-label={label}
                  className="block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
                  href={href}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  <Logo className="h-9 w-auto shrink-0 sm:h-10 lg:h-10.5" />
                </a>
              ) : (
                <Logo className="h-9 w-auto shrink-0 sm:h-10 lg:h-10.5" />
              )}
            </MarqueeItem>
          ))}
        </MarqueeContent>
      </Marquee>
    </section>
  );
}
