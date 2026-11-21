import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, SplitText);

// Rooms render optional elements (wall label, artwork), so empty targets are expected.
gsap.config({ nullTargetWarn: false });

export { gsap, SplitText, useGSAP };
