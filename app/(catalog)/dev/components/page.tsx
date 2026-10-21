import { notFound } from "next/navigation";

// Production-excluded developer catalog. The implementation is imported only inside the
// development branch: in a production build that branch is removed, so the catalog chunk
// is not emitted and cannot be fetched (KF-025). In production the route returns 404.
export default async function ComponentCatalogPage() {
  if (process.env.NODE_ENV !== "production") {
    const { ComponentCatalog } = await import("./catalog-impl");
    return <ComponentCatalog />;
  }
  notFound();
}
