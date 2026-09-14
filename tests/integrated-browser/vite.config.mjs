import {defineConfig,mergeConfig} from 'vite';
import base from '../frontend/vite.config.mjs';
import {fileURLToPath} from 'node:url';
const file=p=>fileURLToPath(new URL(p,import.meta.url));
export default mergeConfig(base,defineConfig({root:file('./'),cacheDir:file('../../node_modules/.vite-integrated-browser'),server:{port:Number(process.env.LOKD_UI_PORT??4395),proxy:{'/api':'http://127.0.0.1:'+(process.env.LOKD_HANDLER_PORT??4396),'/__fixture':'http://127.0.0.1:'+(process.env.LOKD_HANDLER_PORT??4396)}}}));
