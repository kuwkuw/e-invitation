import { LANDING } from "./i18n";

// The seal's monogram (adr-019 §9.2), derived from the brief so nothing new is
// stored. «Марія», «Андрій» → «М&А»; one host → one letter. The model writes a
// couple either as two hosts or as one string naming both, so a conjunction
// splits a name the same way the array does. With no host named it is the
// letter lp-brand-mono derives from INVINTO, so the product's mark is never
// spelled a second way.
const TWO_PEOPLE = /\s+(?:та|і|й|and)\s+|\s*&\s*/iu;

function initial(name: string): string | null {
  const letter = /\p{L}/u.exec(name);
  return letter ? letter[0].toLocaleUpperCase() : null;
}

/** A seal fits three glyphs, so a third host and beyond go unnamed. */
export function monogramFrom(hosts: string[]): string {
  const initials = hosts
    .flatMap((host) => host.split(TWO_PEOPLE))
    .map(initial)
    .filter((letter): letter is string => letter !== null)
    .slice(0, 2);
  return initials.length ? initials.join("&") : [...LANDING.uk.brand][0];
}
