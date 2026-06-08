/** Único usuário administrador do sistema (Firebase Auth UID). */
export const ADMIN_UID = "fC7cWAbUKEY7wGMHdN9z9dcdvX03";

export function isAdminUid(uid) {
  return String(uid || "") === ADMIN_UID;
}
