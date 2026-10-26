export default function Wallpaper() {
  return <div className="living-wallpaper" aria-hidden="true">
    <div className="sky-glow"/>
    <div className="sky-orbit"><span className="sky-sun"/><span className="sky-moon"/></div>
    <svg className="landscape" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <linearGradient id="water-shade" x1="0" y1="690" x2="0" y2="1080" gradientUnits="userSpaceOnUse"><stop stopColor="var(--water-top)"/><stop offset="1" stopColor="var(--water-bottom)"/></linearGradient>
        <linearGradient id="hill-shade" x1="0" y1="650" x2="0" y2="1080" gradientUnits="userSpaceOnUse"><stop stopColor="var(--hill-front)"/><stop offset="1" stopColor="var(--hill-base)"/></linearGradient>
        <linearGradient id="reflection-shade"><stop stopColor="var(--sun-color)" stopOpacity="0"/><stop offset=".5" stopColor="var(--sun-color)" stopOpacity=".38"/><stop offset="1" stopColor="var(--sun-color)" stopOpacity="0"/></linearGradient>
      </defs>
      <g className="sky-stars" fill="#f5f4ff">{Array.from({ length: 42 }, (_, i) => <circle key={i} cx={70 + (i * 173 % 1800)} cy={55 + (i * 89 % 480)} r={i % 4 === 0 ? 1.8 : 1} opacity={.3 + (i % 5) * .13}/>)}</g>
      <g className="sky-cloud cloud-one" stroke="var(--cloud-color)" strokeLinecap="round"><path d="M190 220h220 M230 204h104 M272 236h185" strokeWidth="12" opacity=".3"/><path d="M1070 160h190 M1130 143h80" strokeWidth="10" opacity=".2"/></g>
      <g className="sky-cloud cloud-two" stroke="var(--cloud-color)" strokeLinecap="round"><path d="M1370 320h240 M1420 302h105 M1480 337h180" strokeWidth="14" opacity=".22"/></g>
      <path d="M0 625L140 500 260 554 475 335 690 526 805 460 1020 610 1250 425 1410 555 1640 365 1920 580V1080H0Z" fill="var(--hill-far)"/>
      <path d="M0 690Q210 510 400 625T790 630Q980 490 1180 620T1580 585Q1750 485 1920 610V1080H0Z" fill="var(--hill-mid)"/>
      <path d="M0 730Q310 655 570 722T1130 714Q1510 630 1920 745V1080H0Z" fill="url(#water-shade)"/>
      <g className="water-reflection" stroke="url(#reflection-shade)" strokeLinecap="round"><path d="M1170 767h360 M1120 789h450 M1200 815h330 M1080 846h520 M1140 877h430" strokeWidth="3"/></g>
      <path d="M0 663Q165 630 327 768T690 942L850 1080H0Z" fill="url(#hill-shade)"/>
      <path d="M1920 680Q1720 730 1630 850T1280 1080H1920Z" fill="url(#hill-shade)"/>
      <g fill="var(--tree-color)">{[0, 1, 2, 3, 4, 5, 6].map(i => <path key={i} transform={`translate(${15 + i * 52} ${735 + i * 22}) scale(${1.3 - i * .07})`} d="M0 0l-22 45h13l-23 40h24l-20 35h60L12 85h20L9 45h13Z"/>)}</g>
      <path className="landscape-birds" d="M960 320q12-10 24 0 12-10 24 0 M1020 340q8-7 16 0 8-7 16 0" stroke="var(--tree-color)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <div className="landscape-grain"/>
  </div>;
}
