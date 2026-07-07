import React from "react";
import { useOrganizedApp } from "./hooks/useOrganizedApp.jsx";
import { AppMainView } from "./components/AppMainView.jsx";

export function OrganizedApp(props) {
  const ctx = useOrganizedApp(props);
  return <AppMainView ctx={ctx} />;
}
