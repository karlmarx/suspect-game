const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O for legibility

export function generateRoomCode(): string {
  let out = "";
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[arr[i] % ALPHABET.length];
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}
