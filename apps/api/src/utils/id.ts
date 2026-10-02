export function genId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  for (let i = 0; i < 11; i++) {
    randomPart += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${randomPart}`;
}
