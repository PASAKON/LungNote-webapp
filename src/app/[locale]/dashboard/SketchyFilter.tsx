export function SketchyFilter() {
  return (
    <svg className="sketchy-filter" aria-hidden="true">
      <defs>
        <filter id="sketchy" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.03"
            numOctaves={4}
            seed={2}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={1.8}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
