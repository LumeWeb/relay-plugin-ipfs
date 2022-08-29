import esbuild from 'esbuild'

esbuild.buildSync({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/ipfs.js',
    format: 'cjs',
    bundle: true,
    platform: "node"
})
