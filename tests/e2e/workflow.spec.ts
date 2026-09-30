import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {addMonths,addDays,blockedDays,isWorking,DEFAULT_CALENDAR} from '../../shared/domain';
async function login(page:Page,role:string){await page.goto('/');await page.getByRole('button',{name:role,exact:true}).click();await page.getByRole('button',{name:'Masuk',exact:true}).click();await expect(page.getByRole('heading',{name:'Ringkasan',exact:true})).toBeVisible();}
test('SDM dashboard, filter calendar and mobile layout',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1080});await login(page,'SDM');await expect(page.getByText('Selamat datang, Nadia.')).toBeVisible();
  mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/dashboard-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Kalender cuti',exact:true}).click();await expect(page.locator('.calendar-grid')).toBeVisible();await page.getByLabel('Filter posisi kalender').selectOption('CS_BINA');
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Buka menu'}).click();await page.locator('nav').getByRole('button',{name:'Ringkasan',exact:true}).click();
  await expect(page.locator('.welcome')).toBeVisible();await page.screenshot({path:'artifacts/dashboard-mobile.png',fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('employee submits regular leave, SDM confirms and approves, email captured',async({page,browser})=>{
  await login(page,'Karyawan');const config=await (await page.request.get('/api/config')).json();let start=addMonths(config.today,1);
  while(!isWorking(start,DEFAULT_CALENDAR)||blockedDays(start.slice(0,7),DEFAULT_CALENDAR).includes(start))start=addDays(start,1);
  const month=start.slice(0,7);
  await page.locator('nav').getByRole('button',{name:'Ajukan cuti',exact:true}).click();
  await page.getByLabel('Jenis cuti',{exact:true}).fill('Keperluan keluarga');await page.getByLabel('Alasan pengajuan').fill('Menghadiri acara keluarga untuk pengujian aplikasi.');
  await page.getByLabel('Tanggal mulai',{exact:true}).fill(start);await page.getByLabel('Tanggal akhir',{exact:true}).fill(start);
  await expect(page.getByRole('button',{name:'Tinjau pengajuan'})).toBeEnabled();await page.getByRole('button',{name:'Tinjau pengajuan'}).click();await page.getByRole('button',{name:'Kirim pengajuan'}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByText('Menunggu SDM',{exact:true})).toBeVisible();const title=await dialog.locator('.modal-header h2').innerText();const number=title.replace('Detail ','');
  const other=await browser.newContext();const hr=await other.newPage();await login(hr,'SDM');await hr.getByLabel('Bulan monitoring').fill(month);await hr.locator('nav').getByRole('button',{name:/Pengajuan cuti/}).click();await hr.getByLabel('Cari pengajuan').fill(number);await hr.getByRole('button',{name:'Lihat Alya Rahma '+number,exact:true}).click();
  await expect(hr.getByRole('button',{name:'Setujui pengajuan',exact:true})).toBeDisabled();await hr.getByRole('button',{name:'Jadi mengambil cuti'}).click();await expect(hr.getByText('Karyawan telah mengonfirmasi jadi mengambil cuti.')).toBeVisible();await hr.getByRole('button',{name:'Setujui pengajuan',exact:true}).click();await hr.getByRole('button',{name:'Konfirmasi keputusan'}).click();await expect(hr.getByRole('dialog').getByText('Disetujui',{exact:true})).toBeVisible();
  await page.reload();await page.getByLabel('Bulan monitoring').fill(month);await page.locator('nav').getByRole('button',{name:/Pengajuan saya/}).click();await page.getByLabel('Cari pengajuan').fill(number);await expect(page.locator('tbody').getByText('Disetujui',{exact:true})).toBeVisible();
  await other.close();
});
test('admin shows directory, quotas, working calendar and mail status',async({page})=>{await login(page,'Admin');await page.getByRole('button',{name:'Administrasi',exact:true}).click();await expect(page.getByRole('heading',{name:'Direktori karyawan'})).toBeVisible();await page.getByRole('button',{name:'Posisi & kuota',exact:true}).click();await expect(page.getByRole('heading',{name:'Kuota orang per posisi'})).toBeVisible();await page.getByRole('button',{name:'Kalender kerja',exact:true}).click();await expect(page.getByRole('heading',{name:'Kalender kerja unit'})).toBeVisible();await page.getByRole('button',{name:'Notifikasi email',exact:true}).click();await expect(page.getByRole('heading',{name:'Pengiriman notifikasi'})).toBeVisible();});
