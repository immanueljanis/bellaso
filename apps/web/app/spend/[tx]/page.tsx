export default async function SpendPage({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params;
  return (
    <main className="page">
      <h1>Spend</h1>
      <p className="muted">Payment {tx}. Two transactions with a hybrid signature. SPEC section 7.4.</p>
    </main>
  );
}
