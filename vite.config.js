import { defineConfig } from 'vite';
export default defineConfig({
  // three-vrm 3.5.5 retains a pre-r168 tslFn fallback. This project exclusively
  // uses modern Three.js; map that obsolete branch to the supported TSL Fn.
  plugins: [{ name: 'modern-vrm-tsl', transform(code, id) {
    if (id.includes('@pixiv/three-vrm/') && id.endsWith('/nodes/index.module.js')) return code.replace('THREE_WEBGPU.tslFn(jsFunc)', 'THREE_TSL.Fn(jsFunc)');
  } }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { target: 'es2022', rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vrm', test: /@pixiv/ }] } } } }
});
