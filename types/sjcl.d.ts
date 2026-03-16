declare module 'sjcl' {
  export function decrypt(password: string, ciphertext: string): string;
  export function encrypt(password: string, plaintext: string): string;
}
