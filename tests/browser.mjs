// Browser regression against deterministic HTTP fixtures. Run separately from real PostGIS API tests.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8088';
const server = process.env.TEST_BASE_URL ? null : spawn(process.env.TEST_PYTHON || 'python', ['-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8088'], {cwd:fileURLToPath(new URL('../backend', import.meta.url)), stdio:'ignore'});
for (let i=0;i<60;i++) {
  try { if ((await fetch(base)).ok) break; } catch {}
  if(i===59) { server?.kill(); throw new Error('Test server did not start'); }
  await new Promise(resolve=>setTimeout(resolve,100));
}
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage']});
const context = await browser.newContext({serviceWorkers: 'allow'});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const user = {id: 1, role: 'supervisor', full_name: 'Тестовый руководитель', role_label: 'Руководитель работ'};
const excavations = [{id:1,code:'R-1',year:2026,status:'active'}, {id:2,code:'R-2',year:2026,status:'active'}];
const finding = {id:1,code:'A',number:1,excavation_id:1,excavation_code:'R-1',layer_id:1,layer_number:1,material:'кость',photo_present:false,measurement_method:'manual',north:1,east:2,elev:3,length_mm:20,width_mm:10,thickness_mm:3,issues:[],description:'Кость',created_at:'2026-10-01T12:00:00'};
let savedTemplate;
let created;
let lastPreview;
let offline = false;
await context.addInitScript(() => { localStorage.setItem('arch_api_mode','live'); localStorage.setItem('arch_token','browser-test'); });
await page.route('**/api/**', async route => {
  if (offline) return route.abort();
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  let data = {};
  if (path === '/api/auth/me') data = user;
  else if (path === '/api/excavations') data = excavations;
  else if (path === '/api/layers') data = [{id:1,excavation_id:1,number:1}];
  else if (path === '/api/dictionaries') data = {materials:[{id:1,name:'кость',is_active:true}],color_schemes:[]};
  else if (path === '/api/findings' && req.method() === 'POST') { created = req.postDataJSON(); data = {...finding, ...created}; }
  else if (path === '/api/findings') data = {items:[finding],total:1,page:1};
  else if (path === '/api/findings/1') data = finding;
  else if (path === '/api/gnss') data = [{id:7,excavation_id:1,north:11,east:12,elev:13,comment:'GNSS A'}];
  else if (path === '/api/reports/templates' && req.method() === 'POST') { savedTemplate = {id:5,...req.postDataJSON()}; data = savedTemplate; }
  else if (path === '/api/reports/templates') data = savedTemplate ? [savedTemplate] : [];
  else if (path === '/api/reports') data = [];
  else if (path === '/api/reports/findings') { lastPreview = req.postDataJSON(); data = {total:1,columns:[{key:'code',label:'Код'}],rows:[['A']]}; }
  else if (path === '/api/plan') data = {bounds:{min_x:0,max_x:4,min_y:0,max_y:4},outline:[],points:[{...finding,x:2,y:1,color:'#123456'}],gnss_points:[],legend:[{key:'кость',color:'#123456'}]};
  else if (path === '/api/users') data = [{...user,username:'sup',is_active:true}];
  else if (path === '/api/audit') data = [];
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
});
try {
  console.log('Checking inventory');
  await page.goto(base + '/inventory');
  await page.getByRole('button',{name:'Карточка',exact:true}).waitFor();
  await page.getByLabel('Поиск', {exact:true}).last().fill('Кость');
  await page.getByLabel('Фото',{exact:true}).selectOption('false');
  await page.getByLabel('Регистрация с (UTC)',{exact:true}).fill('2026-10-01');
  await page.getByLabel('Выбрать A',{exact:true}).check();
  await page.getByRole('button',{name:'Экспорт (1)',exact:true}).click();
  assert.equal(await page.getByLabel('Поиск',{exact:true}).last().inputValue(), 'Кость');
  assert.equal(await page.getByLabel('Фото',{exact:true}).inputValue(), 'false');
  await page.getByLabel('Сортировка',{exact:true}).selectOption('elev');
  await page.getByLabel('Порядок',{exact:true}).selectOption('desc');
  page.once('dialog', d => d.accept('Сезон 2026'));
  await page.getByRole('button',{name:'Сохранить шаблон',exact:true}).click();
  await page.getByRole('button',{name:'Сезон 2026',exact:true}).waitFor();
  await page.getByLabel('Поиск',{exact:true}).last().fill('Другое');
  await page.getByRole('button',{name:'Сезон 2026',exact:true}).click();
  assert.equal(await page.getByLabel('Поиск',{exact:true}).last().inputValue(), 'Кость');
  assert.equal(await page.getByLabel('Порядок',{exact:true}).inputValue(), 'desc');
  await page.getByRole('button',{name:'Показать',exact:true}).click();
  await page.getByText('Всего: 1.', {exact:false}).waitFor();
  assert.equal(lastPreview.photo_present, false);
  assert.equal(lastPreview.date_from, '2026-10-01');
  assert.equal(lastPreview.sort, 'elev');
  assert.equal(savedTemplate.sort.order, 'desc');
  console.log('Checking finding form');
  await page.goto(base + '/findings/new');
  await page.getByLabel('Раскоп',{exact:true}).selectOption('1');
  await page.getByLabel('Координаты из GNSS',{exact:true}).selectOption('7');
  assert.equal(await page.getByLabel('North',{exact:true}).inputValue(), '11');
  await page.getByLabel('Развёрнутое описание',{exact:true}).fill('Описание для камеральной обработки');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.waitForURL('**/findings/1');
  assert.equal(created.gnss_point_id, '7');
  assert.equal(created.full_desc, 'Описание для камеральной обработки');
  assert.equal(created.code, undefined);
  assert.equal(created.number, undefined);
  console.log('Checking plan');
  await page.goto(base + '/plan');
  const canvas = page.locator('canvas.plan-canvas'); await canvas.waitFor();
  await page.waitForFunction(() => document.querySelector('canvas')?.__project);
  const before = await canvas.evaluate(c => c.__project.px(2));
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x+250,box.y+150); await page.mouse.down(); await page.mouse.move(box.x+320,box.y+190,{steps:5}); await page.mouse.up();
  await page.waitForFunction((before) => document.querySelector("canvas.plan-canvas").__project.px(2) - before > 50, before);
  const after = await canvas.evaluate(c => c.__project.px(2));
  assert.ok(after-before > 50);
  await page.mouse.move(box.x+150,box.y+100);
  await page.getByText('Курсор (East / North):', {exact:false}).waitFor();
  console.log('Checking inventory');
  await page.goto(base + '/inventory');
  await page.getByRole('button',{name:'Карточка',exact:true}).waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  offline = true;
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button',{name:'Карточка',exact:true}).waitFor();
  assert.equal(await page.locator('select[aria-label="Источник данных"]').inputValue(), 'live');
  await page.getByText('Нет связи. Показаны ранее загруженные данные', {exact:false}).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS browser: inventory export, template restore, GNSS, automatic numbering form, plan drag, offline reload, no React errors');
} catch (error) {
  console.error('Browser errors:', errors);
  console.error((await page.locator('body').innerText()).slice(0, 3000));
  if (process.env.QA_SCREENSHOT) await page.screenshot({path: process.env.QA_SCREENSHOT, fullPage: true});
  throw error;
} finally { await browser.close(); server?.kill(); }
