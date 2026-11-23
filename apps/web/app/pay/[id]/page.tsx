export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="page">
      <h1>Pay {id}</h1>
      <p className="muted">Method 1, the payment link. SPEC section 7.2.</p>
    </main>
  );
}
