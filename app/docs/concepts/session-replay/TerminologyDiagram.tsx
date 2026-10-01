// app/docs/concepts/session-replay/TerminologyDiagram.tsx
//
// Precise, not illustrative-ish: every size and color here is read
// straight from framePlate/theme/defaultTheme.ts, not approximated.
// theme.frame.height, theme.plate.width, theme.frame.padding, the
// exit/deepestScroll bulb length+thickness, and the form imitation's own
// width fraction + stripe sizing are all the real numbers a production
// chart actually uses. Only the plate's height, the outcome color, and the
// form imitation's own position/field-count are chosen freely for this one
// diagram, since those vary per real page visit.
import { defaultTheme } from "@/framePlate";

const FRAME_WIDTH = 180;
const FRAME_HEIGHT = defaultTheme.frame.height; // 340, real value
const PLATE_WIDTH = defaultTheme.plate.width; // 70, real value
const PLATE_HEIGHT = 220; // chosen for this diagram — real plates vary with page height
const FRAME_PADDING = defaultTheme.frame.padding; // 14, real value — plate's offset from the frame's top edge

const FRAME_X = 130;
const FRAME_Y = 24;
const PLATE_X = FRAME_X + (FRAME_WIDTH - PLATE_WIDTH) / 2;
const PLATE_Y = FRAME_Y + FRAME_PADDING;
const PLATE_RIGHT_EDGE = PLATE_X + PLATE_WIDTH;

const EXIT_BULB = defaultTheme.bulbs.exit; // real length/thickness/color
const DEEPEST_BULB = defaultTheme.bulbs.deepestScroll;
const EXIT_Y = PLATE_Y + 120;
const DEEPEST_Y = PLATE_Y + 170;

// Form imitation — an INSET box, not a bulb (see FullPagePlate.tsx): narrower
// than the plate (theme.formImitation.widthFraction), centered, drawn
// submitted-bright since that's the color this diagram's frame outcome
// (converted) implies. Three stripes, same clamp math FullPagePlate itself
// uses, just computed here directly rather than imported.
const FORM_IMITATION = defaultTheme.formImitation;
const FORM_BOX_WIDTH = PLATE_WIDTH * FORM_IMITATION.widthFraction;
const FORM_BOX_X = PLATE_X + (PLATE_WIDTH - FORM_BOX_WIDTH) / 2;
const FORM_BOX_Y = PLATE_Y + 40;
const FORM_BOX_HEIGHT = 40;
const FORM_FIELD_COUNT = 3;
const FORM_STRIPE_WIDTH = FORM_BOX_WIDTH * 0.8;
const FORM_STRIPE_X = FORM_BOX_X + (FORM_BOX_WIDTH - FORM_STRIPE_WIDTH) / 2;
const FORM_STRIPE_SLOT = FORM_BOX_HEIGHT / FORM_FIELD_COUNT;
const FORM_STRIPE_THICKNESS = Math.min(FORM_IMITATION.maxStripeThicknessPx, Math.max(FORM_IMITATION.minStripeThicknessPx, FORM_STRIPE_SLOT * 0.5));

function Callout({ from, to, label }: { from: [number, number]; to: [number, number]; label: string }) {
  return (
    <g>
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#77756d" strokeWidth={1} />
      <circle cx={from[0]} cy={from[1]} r={3} fill="var(--lime)" />
      <text x={to[0]} y={to[1]} textAnchor={to[0] < from[0] ? "end" : "start"} dy={-6} fontFamily="monospace" fontSize={13} fontWeight={700} fill="var(--lime)">
        {label}
      </text>
    </g>
  );
}

export function TerminologyDiagram() {
  return (
    <svg
      viewBox="0 0 440 380"
      className="w-full max-w-lg"
      role="img"
      aria-label="Diagram labeling the frame, the plate inside it, the inset form imitation box, and a bulb on the plate's edge"
    >
      {/* path label — sits above the frame, not part of the frame's own rectangle */}
      <text x={FRAME_X + FRAME_WIDTH / 2} y={FRAME_Y - 8} textAnchor="middle" fontFamily="monospace" fontSize={11} fill="#8b8980">
        /contact
      </text>

      {/* the frame: the whole colored column, keyed by outcome */}
      <rect x={FRAME_X} y={FRAME_Y} width={FRAME_WIDTH} height={FRAME_HEIGHT} fill={defaultTheme.frame.backgroundByOutcome.converted} />

      {/* the plate: the inner page miniature, fixed width, height scaled to the real page */}
      <rect x={PLATE_X} y={PLATE_Y} width={PLATE_WIDTH} height={PLATE_HEIGHT} fill="#111111" stroke="#3a3a3a" strokeWidth={1.5} rx={2} />
      <rect x={PLATE_X} y={PLATE_Y} width={PLATE_WIDTH} height={140} fill={defaultTheme.seenOnce.color} />
      <rect x={PLATE_X} y={PLATE_Y + 140} width={PLATE_WIDTH} height={50} fill={defaultTheme.seenTwice.color} />

      {/* form imitation — INSET inside the plate, narrower than it, not protruding past its edge like a bulb */}
      <rect x={FORM_BOX_X} y={FORM_BOX_Y} width={FORM_BOX_WIDTH} height={FORM_BOX_HEIGHT} rx={FORM_IMITATION.cornerRadius} fill={FORM_IMITATION.submittedColor} />
      {Array.from({ length: FORM_FIELD_COUNT }).map((_, i) => (
        <rect
          key={i}
          x={FORM_STRIPE_X}
          y={FORM_BOX_Y + i * FORM_STRIPE_SLOT + FORM_STRIPE_SLOT / 2 - FORM_STRIPE_THICKNESS / 2}
          width={FORM_STRIPE_WIDTH}
          height={FORM_STRIPE_THICKNESS}
          fill={FORM_IMITATION.stripeColor}
        />
      ))}

      {/* two bulbs, real geometry, protruding from the plate's right edge, not the frame's edge */}
      <rect x={PLATE_RIGHT_EDGE} y={EXIT_Y - EXIT_BULB.thickness / 2} width={EXIT_BULB.length} height={EXIT_BULB.thickness} fill={EXIT_BULB.color} />
      <rect x={PLATE_RIGHT_EDGE} y={DEEPEST_Y - DEEPEST_BULB.thickness / 2} width={DEEPEST_BULB.length} height={DEEPEST_BULB.thickness} fill={DEEPEST_BULB.color} />

      {/* callouts — leader line from the exact edge being labeled, out to clear space */}
      <Callout from={[FRAME_X, FRAME_Y]} to={[30, FRAME_Y - 6]} label="Frame" />
      <Callout from={[PLATE_X, PLATE_Y]} to={[30, PLATE_Y + 90]} label="Plate" />
      <Callout from={[FORM_BOX_X + FORM_BOX_WIDTH, FORM_BOX_Y + FORM_BOX_HEIGHT / 2]} to={[380, FORM_BOX_Y + 6]} label="Form imitation" />
      <Callout from={[PLATE_RIGHT_EDGE + DEEPEST_BULB.length, DEEPEST_Y]} to={[380, DEEPEST_Y]} label="Bulb" />
    </svg>
  );
}
