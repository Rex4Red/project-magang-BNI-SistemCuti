import {test,expect} from '@playwright/test';
import type {Leave} from '../../shared/domain';

test('SDM queues new requests outside home and opens their details without stacked dialogs',async({page},testInfo)=>{
  let extra:Leave[]=[];
  let baseline:any;
  await page.route('**/api/dashboard?*',async route=>{
    const response=await route.fetch();const data=await response.json();baseline=data;
    await route.fulfill({response,json:{...data,requests:[...data.requests,...extra]}});
  });
  await page.goto('/');await page.getByRole('button',{name:'SDM',exact:true}).click();await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await expect(page.locator('.stats-grid')).toBeVisible();
  const popup=page.getByRole('dialog',{name:'Pengajuan menunggu review',exact:true});await expect(popup).toBeVisible();
  await popup.getByRole('button',{name:'Tutup',exact:true}).click();
  await page.reload();await expect(page.locator('.stats-grid')).toBeVisible();await expect(popup).toHaveCount(0);
  await page.locator('nav').getByRole('button',{name:/Pengajuan cuti/}).click();
  const seed=baseline.requests.find((r:Leave)=>r.status==='PENDING_SDM');
  extra=[{...seed,id:'popup-one',number:'CT-POPUP-1',employeeName:'Karyawan Popup Satu'}, {...seed,id:'popup-two',number:'CT-POPUP-2',employeeName:'Karyawan Popup Dua'}];
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button',{name:'Lihat Karyawan Popup Satu CT-POPUP-1',exact:true})).toBeVisible();await expect(popup).toHaveCount(0);
  await page.locator('nav').getByRole('button',{name:'Ringkasan',exact:true}).click();await expect(popup).toBeVisible();
  await expect(popup).toContainText('2 pengajuan');
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>popup.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('new-leave-popup-mobile.png')});
  await popup.getByRole('button',{name:'Lihat pengajuan CT-POPUP-1'}).click();
  await expect(page.getByRole('dialog',{name:'Detail CT-POPUP-1',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('button',{name:'Tutup dialog',exact:true}).click();await expect(popup).toBeVisible();await expect(popup).not.toContainText('Karyawan Popup Satu');
  await popup.getByRole('button',{name:'Tutup',exact:true}).click();
  const updated=page.waitForResponse(r=>r.url().includes('/api/dashboard?')&&r.ok());await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await updated;
  await expect(popup).toHaveCount(0);
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'Profil saya',exact:true}).click();
  await page.getByRole('button',{name:'Keluar dari akun'}).click();
  await page.getByRole('button',{name:'SDM',exact:true}).click();await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await expect(popup).toBeVisible();await expect(popup).toContainText('Karyawan Popup Satu');
});
