import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const KEY_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  resolve(__dirname, "serviceAccountKey.json");

if (!existsSync(KEY_PATH)) {
  console.error(`Arquivo não encontrado: ${KEY_PATH}`);
  console.error("Defina FIREBASE_SERVICE_ACCOUNT_PATH ou coloque serviceAccountKey.json em scripts/");
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(KEY_PATH, "utf8"))),
});

let nextPageToken;
let total = 0;

do {
  const result = await getAuth().listUsers(1000, nextPageToken);
  nextPageToken = result.pageToken;

  for (const user of result.users) {
    const current = user.customClaims || {};
    if (current.role === "authenticated") {
      console.log("⏭ ", user.email || user.uid, "(já tinha role)");
      continue;
    }
    await getAuth().setCustomUserClaims(user.uid, { ...current, role: "authenticated" });
    console.log("✅", user.email || user.uid);
    total++;
  }
} while (nextPageToken);

console.log(`\nConcluído! ${total} usuário(s) atualizado(s).`);
console.log("Peça para cada usuário fazer logout e login de novo para o token atualizar.");
