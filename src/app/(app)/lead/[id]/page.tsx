import { Ficha } from "@/componentes/ficha/ficha";

export default async function PaginaLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Ficha id={id} />;
}
