import base from './playwright.config.mjs';
import {fileURLToPath} from 'node:url';
const results=fileURLToPath(new URL('../../test-results/presence-diagnostic/',import.meta.url));
export default {...base,testMatch:'presence.spec.mjs',outputDir:results+'run',reporter:[['list'],['json',{outputFile:results+'results.json'}]],webServer:{...base.webServer,command:base.webServer.command+' --presence-only'}};
