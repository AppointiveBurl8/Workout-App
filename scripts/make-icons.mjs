// Renders the app icon to the PNG sizes a home-screen install needs.
// Run it by hand after editing public/icons/icon.svg, and commit the output -
// the build must not depend on this, or on sharp being installable.
//
//   node scripts/make-icons.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')
const source = await readFile(join(iconsDir, 'icon.svg'))

// apple-touch-icon is composited onto white: iOS ignores transparency and the
// source is full-bleed anyway, but a flattened PNG is smaller and unambiguous.
const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of targets) {
  const png = await sharp(source, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(join(iconsDir, name), png)
  console.log(`${name}  ${size}x${size}  ${png.length} bytes`)
}
