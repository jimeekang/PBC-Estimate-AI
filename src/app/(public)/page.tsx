import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PublicAuthRedirect } from '@/components/public-auth-redirect';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle,
  Home,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

const BOOKING_URL =
  'https://clienthub.getjobber.com/booking/3a242065-0473-4039-ac49-e0a471328f15/';

const serviceCards = [
  {
    title: 'Interior Painting',
    emoji: '🏠',
    description: 'Full house repaint, feature walls, ceiling repaint, and more.',
    tags: ['Full repaint', 'Feature walls', 'Ceiling repaint'],
  },
  {
    title: 'Exterior Painting',
    emoji: '🏡',
    description: 'Weatherboard, rendered walls, and complete exterior makeovers.',
    tags: ['Weatherboard', 'Rendered walls', 'Full exterior'],
  },
  {
    title: 'Trim & Doors',
    emoji: '🚪',
    description: 'Skirting boards, doors, window frames, handrails, and detail work.',
    tags: ['Skirting boards', 'Doors', 'Window frames'],
  },
  {
    title: 'Roof Painting',
    emoji: '🏗️',
    description: 'Tile, metal, and Colorbond roof repaints to protect and refresh your home.',
    tags: ['Tile roofs', 'Metal roofs', 'Colorbond'],
  },
  {
    title: 'Deck & Timber',
    emoji: '🪵',
    description: 'Deck staining, oiling, and repaints for timber and composite surfaces.',
    tags: ['Deck stain', 'Timber oil', 'Repaint'],
  },
  {
    title: 'Paving & Concrete',
    emoji: '🧱',
    description: 'Driveway, pathway, and pool surrounds — sealed and painted for lasting results.',
    tags: ['Driveways', 'Pool surrounds', 'Pathways'],
  },
];

const trustStats = [
  {
    stat: 'FREE On-Site Quote',
    detail: 'A painter comes to you — book anytime',
    icon: CalendarCheck,
  },
  {
    stat: '2 Free AI Estimates',
    detail: 'No signup fee, no obligation',
    icon: Sparkles,
  },
  {
    stat: 'Northern Beaches Specialists',
    detail: 'Sydney-calibrated pricing, local expertise',
    icon: Home,
  },
];

const googleReviews = [
  {
    name: 'K So',
    date: '8 weeks ago',
    text: "I'm satisfied with the work Connor and his team did. They painted the five doors at our home, and the price was fair. Communication was clear, they showed up on time, and they took care to protect the surrounding areas while they worked. The finish looks neat and even, and they cleaned up properly afterwards.",
  },
  {
    name: 'Joy Simonsen',
    date: '5 weeks ago',
    text: "We highly recommend Paint Buddy & Co. Their communication and expertise made the whole experience easy with a respectful and professional attitude on the job. On time and with attention to every detail, our home now looks amazing and fresh. Thanks Connor and team!",
  },
  {
    name: 'Jane Newman',
    date: '4 weeks ago',
    text: "Paint Buddy & Co have just completed painting the exterior of my home. Connor & his team were totally professional, meticulous, tidy & friendly throughout the whole process. I definitely would recommend them for your painting needs.",
  },
  {
    name: 'Hannah Ireland',
    date: '4 weeks ago',
    text: "Connor and his team were absolutely 5 star. The attention to detail is of the highest standard. I had a very short deadline and Connor and his team even worked nights to get it done for me. They offer useful advice on colours and paint types. Their communication is excellent with daily updates and alert emails. When the job is done the site is left so clean and tidy. I am renovating in a year and I will be calling Connor again.",
  },
  {
    name: 'Annie Holland',
    date: '2 weeks ago',
    text: "We recently used Paint Buddy for the second time, this time at a different house, and once again Connor and his team did an outstanding job. Connor is incredibly organised, friendly, and communicates really well throughout the entire process. Everything ran smoothly from start to finish. The quality of the work is excellent. The team takes great care with preparation and the finished result looks fantastic. It's clear they take a lot of pride in their work. We wouldn't hesitate to recommend Connor and his team to anyone looking for professional painters who do a truly great job.",
  },
  {
    name: 'K Wong',
    date: '8 weeks ago',
    text: "Connor and his team did a fantastic job painting our garage at a reasonable price. They were patient and helped us move items out of the garage, and they clean the floor before starting. The whole process was on time, efficient, friendly, and very attentive. We would happily hire Connor again in the future.",
  },
];

const sampleFactors = [
  '3-bedroom, 2-storey home interior',
  'Walls + ceilings, standard height',
  'Good condition — minimal prep required',
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PublicAuthRedirect />

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-24">
        <Image
          src="/logo-bg-remove.png"
          alt="Paint Buddy & Co Logo"
          width={100}
          height={100}
          className="mx-auto mb-6 rounded-full shadow-md"
          priority
        />
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          Instant Painting Quotes — <span className="text-primary">Powered by AI</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-500 sm:text-xl">
          Get a professional estimate for your Sydney Northern Beaches property in minutes.
          Calibrated to real local pricing — no guesswork.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full max-w-xs shadow-lg sm:w-auto">
            <Link href="/login">
              Get My Free Estimate
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-medium text-primary opacity-70 underline-offset-4 hover:opacity-100 hover:underline"
          >
            Or book a FREE on-site quote
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* Sample Estimate Preview */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              See What an AI Estimate Looks Like
            </h2>
            <p className="mt-2 text-gray-500">
              Here&apos;s a real-format sample — your estimate will look just like this.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="absolute right-3 top-3 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                <Sparkles className="h-3 w-3" />
                Sample Preview — Login to generate yours
              </span>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-5 pr-32 sm:px-8 sm:pr-36">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                AI Estimate — Interior
              </p>
              <h3 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
                3-Bedroom House Interior
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">Sydney Northern Beaches</p>
            </div>

            <div className="border-b border-gray-100 px-6 py-6 sm:px-8">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Estimated Price Range
              </p>
              <p className="mt-2 text-4xl font-extrabold text-gray-900 sm:text-5xl">
                $7,800 <span className="text-2xl font-semibold text-gray-400">–</span> $11,500
                <span className="ml-2 text-xl font-semibold text-gray-500">+GST</span>
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Range reflects paint quality, prep requirements, and finish level.
              </p>
            </div>

            <div className="px-6 py-5 sm:px-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Based on
              </p>
              <ul className="space-y-2">
                {sampleFactors.map((factor) => (
                  <li key={factor} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 sm:px-8">
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-sm text-gray-500">
                  Login to generate a personalised estimate for your property.
                </p>
                <Button asChild size="sm">
                  <Link href="/login">
                    Generate Mine <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services / What customers ask */}
      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              What Our Customers Ask Most
            </h2>
            <p className="mt-2 text-gray-500">
              Common painting projects on the Northern Beaches — with real price hints.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {serviceCards.map((card) => (
              <div
                key={card.title}
                className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 p-6 cursor-default"
              >
                <span className="mb-3 text-3xl">{card.emoji}</span>
                <h3 className="text-lg font-bold text-gray-900">{card.title}</h3>
                <p className="mt-1 flex-1 text-sm text-gray-500">{card.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Why Use PBC Estimate AI?
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {trustStats.map(({ stat, detail, icon: Icon }) => (
              <div
                key={stat}
                className="flex flex-col items-center rounded-2xl border border-primary/20 bg-white p-6 text-center shadow-sm"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-base font-bold text-gray-900">{stat}</p>
                <p className="mt-1 text-sm text-gray-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Google Reviews */}
      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                <span className="text-[#4285F4]">G</span>
                <span className="text-[#EA4335]">o</span>
                <span className="text-[#FBBC05]">o</span>
                <span className="text-[#4285F4]">g</span>
                <span className="text-[#34A853]">l</span>
                <span className="text-[#EA4335]">e</span>
              </span>
              <span className="text-lg font-bold text-gray-900">Reviews</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-gray-900">5.0</span>
              <span className="text-2xl text-amber-400">★★★★★</span>
              <span className="text-sm text-gray-400">(104 reviews)</span>
            </div>
            <a
              href="https://www.google.com/search?q=paint+buddy+%26+co"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              See all reviews on Google
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {googleReviews.map((review) => (
              <div
                key={review.name}
                className="flex flex-col rounded-2xl border border-gray-100 bg-gray-50 p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {review.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{review.name}</p>
                    <p className="text-xs text-gray-400">{review.date}</p>
                  </div>
                </div>

                <p className="mb-2 text-base text-amber-400">★★★★★</p>

                <p
                  className={`flex-1 text-sm leading-relaxed text-gray-600 ${
                    review.text.length > 150 ? 'line-clamp-4' : ''
                  }`}
                >
                  {review.text}
                </p>

                <div className="mt-4 flex justify-end">
                  <span className="text-xs font-semibold">
                    <span className="text-[#4285F4]">G</span>
                    <span className="text-[#EA4335]">o</span>
                    <span className="text-[#FBBC05]">o</span>
                    <span className="text-[#4285F4]">g</span>
                    <span className="text-[#34A853]">l</span>
                    <span className="text-[#EA4335]">e</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary px-4 py-16 text-center text-white sm:py-20">
        <div className="mx-auto max-w-2xl space-y-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Ready to get your estimate?</h2>
          <p className="text-lg text-primary-foreground/80">
            2 free AI estimates included — no credit card required.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="w-full max-w-xs sm:w-auto"
            >
              <Link href="/login">
                Start Free Estimate
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              Book FREE on-site quote instead
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
