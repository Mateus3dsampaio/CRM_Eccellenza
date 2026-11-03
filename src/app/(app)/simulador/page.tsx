import { notFound } from "next/navigation";
import { modoSimulador } from "@/lib/modo";
import { Simulador } from "@/componentes/simulador/simulador";

export default function PaginaSimulador() {
  if (!modoSimulador()) notFound();
  return <Simulador />;
}
