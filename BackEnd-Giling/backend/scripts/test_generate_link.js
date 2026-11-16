// Using native node fetch

(async () => {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password' })
  const authObj = await loginRes.json();
  const token = authObj.token || authObj.data?.token || authObj.data;

  // Create Batch
  const batchRes = await fetch('http://localhost:3000/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batchDate: new Date().toISOString().split('T')[0] })
  });
  const { data: batch } = await batchRes.json();

  // Generate Link
  const linkRes = await fetch(`http://localhost:3000/api/batches/${batch.id}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ formType: 'PURCHASE', expiresAt: null })
  });
  
  const linkData = await linkRes.json();
  console.log("LINK GENERATED:", linkData.data.link_code);

})();
