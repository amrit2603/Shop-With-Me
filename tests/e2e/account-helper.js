export async function registerHost(request,name='Alice'){
 const r=await request.post('/api/auth/register',{headers:{Origin:'http://localhost:5173'},data:{email:`host-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,password:'Correct-horse-472!',displayName:name}});
 if(r.status()!==201)throw new Error('Host account setup failed: '+await r.text());
 return r.json();
}
export async function signInHost(page,name='Alice'){await page.goto('/');await page.getByLabel('Your name',{exact:true}).fill(name);await page.getByRole('button',{name:'Enter demo',exact:true}).click();await page.locator('#room-title-input').waitFor();}
