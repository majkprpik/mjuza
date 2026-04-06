import { customAlphabet } from "nanoid";

const generateCode = customAlphabet(
  "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  5
);

export function createRoomCode(): string {
  return generateCode();
}
