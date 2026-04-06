import { generateFunName } from "./fun-names";

const GUEST_ID_KEY = "mjuza-guest-id";
const GUEST_NAME_KEY = "mjuza-guest-name";

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestName(): string {
  let name = localStorage.getItem(GUEST_NAME_KEY);
  if (!name) {
    name = generateFunName();
    localStorage.setItem(GUEST_NAME_KEY, name);
  }
  return name;
}

export function setGuestName(name: string): void {
  localStorage.setItem(GUEST_NAME_KEY, name);
}
