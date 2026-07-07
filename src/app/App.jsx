import React from "react";
import { isFirebaseConfigured } from "../services/firebase.js";
import { OrganizedApp } from "./OrganizedApp.jsx";

export default function App() {
  const firebaseOk = isFirebaseConfigured();
  const isProd = import.meta.env.PROD;
  return <OrganizedApp firebaseOk={firebaseOk} isProd={isProd} />;
}
