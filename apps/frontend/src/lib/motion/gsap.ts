import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, SplitText);

// Rooms render optional elements (wall label, artwork), so empty targets are expected.
gsap.config({ nullTargetWarn: false });

// Animations keep real time on slow machines: by default GSAP slows its clock
// after long frames, which kept rooms hidden for tens of seconds at low frame
// rates. Content now always arrives on schedule, even if fewer frames show.
gsap.ticker.lagSmoothing(0);

export { gsap, SplitText, useGSAP };
