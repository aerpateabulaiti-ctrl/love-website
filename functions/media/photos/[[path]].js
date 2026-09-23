import { forward } from '../../../server/proxy.mjs';
export function onRequest(context) { return forward(context, 'image'); }
