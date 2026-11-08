// Reading the list an admin pastes from a spreadsheet to add their team.

export interface ListedPerson {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  mobile: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,}$/;

/** One person per line: name first, then job title, email and mobile in any order, separated by tabs or commas. */
export function parseTeamList(raw: string, max = 500): ListedPerson[] {
  const people: ListedPerson[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const parts = line.split(line.includes("\t") ? "\t" : ",").map((p) => p.trim());
    const name = parts[0] ?? "";
    if (!name || /^(full\s*|first\s*)?name$/i.test(name)) continue;
    const rest = parts.slice(1).filter(Boolean);
    const email = rest.find((p) => EMAIL.test(p)) ?? "";
    const mobile = rest.find((p) => p !== email && PHONE.test(p)) ?? "";
    const jobTitle = rest.find((p) => p !== email && p !== mobile) ?? "";
    const [first, ...others] = name.split(/\s+/);
    people.push({ firstName: first.slice(0, 100), lastName: others.join(" ").slice(0, 100), jobTitle: jobTitle.slice(0, 200), email: email.slice(0, 255), mobile: mobile.slice(0, 50) });
    if (people.length >= max) break;
  }
  return people;
}
