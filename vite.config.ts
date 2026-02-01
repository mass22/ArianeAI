import { createHash } from 'crypto'

// Polyfill pour crypto.hash() qui n'existe pas dans Node.js
// Vite 7+ essaie d'utiliser crypto.hash() mais Node.js utilise crypto.createHash()
if (!globalThis.crypto?.hash) {
  globalThis.crypto = {
    ...globalThis.crypto,
    hash: (algorithm: string) => createHash(algorithm),
  } as Crypto
}

export default {}
