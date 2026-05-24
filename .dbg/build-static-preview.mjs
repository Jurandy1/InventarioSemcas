import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: ".dbg/static-preview/app.js",
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
  },
  define: {
    "import.meta.env.PROD": "false",
    "import.meta.env.BASE_URL": "\"/\"",
    "import.meta.env.VITE_FB_API_KEY": "\"AIzaSyB4a_cyt_ynZ13TWIlwgy6NS4wwREGEdBk\"",
    "import.meta.env.VITE_FB_PROJECT_ID": "\"iventariosemcas\"",
    "import.meta.env.VITE_FB_STORAGE_BUCKET": "\"iventariosemcas.firebasestorage.app\"",
  },
  logLevel: "info",
});
