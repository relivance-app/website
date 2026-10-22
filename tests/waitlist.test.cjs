const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'waitlist.js'), 'utf8');
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.hidden = true; this.dataset = {}; this.events = {}; this.attrs = {}; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this.attrs[name] = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  focus() { this.focused = true; }
}
function fixture(options = {}) {
  const ids = Object.fromEntries(['year','access-form','email','access-error','access-success','website'].map((id) => [id, new Element()]));
  const form = ids['access-form']; const button = new Element(); button.disabled = true;
  form.dataset.turnstileSitekey = options.noKey ? '' : 'mock-public-key';
  form.querySelector = () => button;
  const calls = []; const scripts = []; const timers = new Map(); let nextTimer = 0;
  let callbacks; let resets = 0; let removed = 0;
  const window = { matchMedia: () => ({ matches: !!options.small }), turnstile: {
    render: (_, settings) => { callbacks = settings; return 'widget'; },
    reset: () => { resets++; }, remove: () => { removed++; },
  } };
  const fetch = async (url, init) => {
    calls.push({url,init});
    if (options.fetch) return options.fetch(url, init);
    return { ok: true, json: async () => ({ code: 'registered' }) };
  };
  vm.runInNewContext(code, { document: { getElementById: (id) => ids[id], head: { appendChild: (script) => scripts.push(script) }, createElement: () => ({}) },
    window, fetch, TextEncoder, AbortSignal, Date,
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: (id) => timers.delete(id) });
  if (!options.noKey) window.waitlistTurnstileReady();
  const submit = () => form.events.submit({ preventDefault() {} });
  return {ids,form,button,calls,scripts,submit,window,get callbacks(){return callbacks;},get resets(){return resets;},get removed(){return removed;}};
}
test('success normalizes email and preserves inline accessible success', async () => {
  const f = fixture(); f.ids.email.value = '  Name+Tag@Example.com ';
  f.callbacks.callback('opaque-token'); await f.submit();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), {email:'name+tag@example.com',captchaToken:'opaque-token',website:''});
  assert.equal(f.calls[0].init.credentials,'omit');
  assert.equal(f.form.dataset.state,'success'); assert.equal(f.ids.email.disabled,true);
  assert.equal(f.ids['access-success'].textContent,'You’re on the early access list.');
  assert.equal(f.button.disabled,true); assert.equal(f.removed,1);
  await f.submit(); assert.equal(f.calls.length,1);
});
test('invalid email is focused and announced with no network call', async () => {
  const f = fixture(); f.ids.email.value='invalid'; f.callbacks.callback('token'); await f.submit();
  assert.equal(f.calls.length,0); assert.equal(f.ids.email.focused,true);
  assert.equal(f.ids.email.attrs['aria-invalid'],'true'); assert.equal(f.ids['access-error'].hidden,false);
});
test('concurrent clicks have only one request and expose busy state', async () => {
  let finish; const promise = new Promise((resolve) => {finish=resolve;});
  const f=fixture({fetch:()=>promise}); f.ids.email.value='a@example.com'; f.callbacks.callback('token');
  const first=f.submit(); await f.submit(); assert.equal(f.calls.length,1);
  assert.equal(f.form.attrs['aria-busy'],'true'); assert.equal(f.button.disabled,true);
  finish({ok:true,json:async()=>({code:'registered'})}); await first;
  assert.equal(f.form.attrs['aria-busy'],undefined);
});
for (const code of ['verification_required','invalid_email','temporarily_unavailable']) {
  test(`server ${code} stays retryable, private, resets CAPTCHA`, async()=>{
    const f=fixture({fetch:async()=>({ok:false,json:async()=>({code,message:'PRIVATE email@example.com'})})});
    f.ids.email.value='a@example.com';f.callbacks.callback('consumed');await f.submit();
    assert.equal(f.resets,1);assert.equal(f.button.disabled,true);assert.equal(f.ids.email.readOnly,false);
    assert.equal(f.form.dataset.state,undefined);assert.ok(!f.ids['access-error'].textContent.includes('PRIVATE'));
    f.callbacks.callback('fresh');assert.equal(f.button.disabled,false);
  });
}
test('network failure clears busy state and requires fresh token for retry',async()=>{
  const f=fixture({fetch:async()=>{throw Error('private');}}); f.ids.email.value='a@example.com';f.callbacks.callback('token');await f.submit();
  assert.match(f.ids['access-error'].textContent,/Network error/);assert.equal(f.resets,1);assert.equal(f.button.disabled,true);
});
test('expiry, verification errors and challenge timeout cannot submit stale token',async()=>{
  const f=fixture();f.ids.email.value='a@example.com';f.callbacks.callback('token');f.callbacks['expired-callback']();await f.submit();
  assert.equal(f.calls.length,0);assert.equal(f.button.disabled,true);
  f.callbacks['error-callback']();assert.match(f.ids['access-error'].textContent,/Verification is unavailable/);
  f.callbacks['timeout-callback']();assert.equal(f.resets,1);
});
test('blank deployment key fails closed and loads no third-party script',async()=>{
  const f=fixture({noKey:true});assert.equal(f.scripts.length,0);assert.equal(f.button.disabled,true);
  f.ids.email.value='a@example.com';await f.submit();assert.equal(f.calls.length,0);
});
test('small screens use compact challenge; others use flexible widget',()=>{
  assert.equal(fixture({small:true}).callbacks.size,'compact');assert.equal(fixture().callbacks.size,'flexible');
});
test('honeypot is forwarded as supplementary server-side signal',async()=>{
  const f=fixture();f.ids.email.value='a@example.com';f.ids.website.value='spam';f.callbacks.callback('token');await f.submit();
  assert.equal(JSON.parse(f.calls[0].init.body).website,'spam');
});
test('HTML/processor disclosures preserve purpose, retention and removal; no active legacy dependency',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/<button type="submit" class="access-submit" disabled>/);
  assert.match(html,/<noscript>[\s\S]*JavaScript is required/);
  assert.match(html,/aria-live="polite"/);assert.match(html,/role="alert"/);assert.match(html,/access-purpose/);
  assert.match(html,/tabindex="-1"/);assert.match(html,/Request Early Access/);
  const privacy=fs.readFileSync(path.join(root,'privacy/index.html'),'utf8');
  assert.match(privacy,/Cloudflare/);assert.match(privacy,/Supabase/);assert.match(privacy,/twelve\s+months after Relivance has publicly launched/);
  assert.match(privacy,/remove your email/);
  for(const file of ['index.html','waitlist.js','privacy/index.html','terms/index.html','README.md'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/formspree/i);
  assert.doesNotMatch(code,/service.role|apikey|Authorization|console\./i);
});
