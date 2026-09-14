import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const file=p=>fileURLToPath(new URL(p,import.meta.url));
// UI-only fixture server. No Worker, auth session, D1, or external providers.
export default defineConfig({root:file('./'),cacheDir:file('../../node_modules/.vite-frontend'),publicDir:file('../../public'),plugins:[react()],resolve:{dedupe:['react','react-dom'],alias:{'next/image':file('../../node_modules/vinext/dist/shims/image.js'),'next/link':file('./link.tsx'),'next/navigation':file('./navigation.ts'),'@clerk/react':file('./clerk.ts')}},server:{host:'127.0.0.1',port:4179,strictPort:true,fs:{allow:[file('../../')]}}});
