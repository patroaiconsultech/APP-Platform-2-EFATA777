import { useState } from "react";
export function LoginPanel({onLogin}) {
  const [tenantId,setTenantId] = useState("tenant-demo");
  const [userId,setUserId] = useState("user-demo");
  const [role,setRole] = useState("member");
  return (
    <main><form onSubmit={(event)=>{event.preventDefault();onLogin({tenantId,userId,role});}}>
      <h1>ORKIO RC1 Test</h1>
      <p>Headers de identidade existem apenas no ambiente RC1 isolado.</p>
      <label>Tenant<input value={tenantId} onChange={(e)=>setTenantId(e.target.value)} required /></label>
      <label>Usuário<input value={userId} onChange={(e)=>setUserId(e.target.value)} required /></label>
      <label>Papel<select value={role} onChange={(e)=>setRole(e.target.value)}>
        <option value="member">Membro</option><option value="admin">Administrador</option>
      </select></label>
      <button type="submit">Entrar</button>
    </form></main>
  );
}
